import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { adviseQueryPlan, createIndexSql, parseConditionColumns, readTableAliases } from '../../../../server/services/database/query-advice'
import {
  normalizeMySqlPlan,
  normalizePostgresPlan,
  normalizeSqlServerPlan,
  readSqlServerMissingIndexes
} from '../../../../server/services/database/query-plan'
import type { QueryPlan, QueryPlanNode } from '../../../../server/types/database'

const fixture = (name: string) => readFileSync(`tests/server/services/database/fixtures/plans/${name}`, 'utf8')
const SQL = 'select grp, count(*) from big where label like \'a%\' group by grp order by 2 desc'
const plan = (engine: QueryPlan['engine'], root: QueryPlanNode, extra: Partial<QueryPlan> = {}): QueryPlan => ({ engine, analyzed: false, root, raw: '', ...extra })

describe('query advice from real plans', () => {
  it('suggests a PostgreSQL index that LIKE \'a%\' can use, built without blocking writes', () => {
    expect(adviseQueryPlan(plan('postgres', normalizePostgresPlan(fixture('pg.json'))), SQL)).toEqual([
      expect.objectContaining({ kind: 'add_index', table: 'big', columns: ['label'], sql: 'CREATE INDEX CONCURRENTLY idx_big_label ON big (label text_pattern_ops);' })
    ])
  })

  it.each(['mysql.json', 'mariadb.json'])('suggests the index for %s', (name) => {
    expect(adviseQueryPlan(plan('mysql', normalizeMySqlPlan(fixture(name))), SQL)).toContainEqual(
      expect.objectContaining({ kind: 'add_index', table: 'big', columns: ['label'], sql: 'CREATE INDEX idx_big_label ON big (label);' })
    )
  })

  it('uses the index SQL Server itself asks for, with its estimated impact', () => {
    const xml = fixture('mssql.xml')
    const advice = adviseQueryPlan(plan('mssql', normalizeSqlServerPlan(xml, false), { missingIndexes: readSqlServerMissingIndexes(xml) }), SQL)

    expect(advice).toEqual([
      expect.objectContaining({ kind: 'add_index', table: 'big', columns: ['label'], fromDatabase: true, impact: 47, sql: 'CREATE INDEX idx_big_label ON dbo.big (label) INCLUDE (grp);' })
    ])
  })
})

describe('query advice rules', () => {
  const scan = (condition: string, extra: Partial<QueryPlanNode> = {}): QueryPlanNode => ({ operation: 'Seq Scan', table: 'customers', condition, estimatedRows: 5000, warnings: ['full_scan'], children: [], ...extra })

  it('explains that a leading wildcard cannot use an index', () => {
    expect(adviseQueryPlan(plan('postgres', scan('(email ~~ \'%@example.com\'::text)')), 'select * from customers')).toEqual([
      { kind: 'leading_wildcard', table: 'customers', columns: ['email'] },
      { kind: 'reduce_rows', rows: 5000 }
    ])
  })

  it('suggests an expression index when a function wraps the column', () => {
    expect(adviseQueryPlan(plan('postgres', scan('(lower(email) = \'a@b.c\'::text)', { estimatedRows: 1 })), 'select 1 from customers')).toEqual([
      { kind: 'function_on_column', table: 'customers', columns: ['lower(email)'], sql: 'CREATE INDEX CONCURRENTLY idx_customers_lower_email ON customers ((lower(email)));' }
    ])
  })

  it('puts equality columns before a range, and maps aliases back to tables', () => {
    const node = scan('((`o`.`status` = \'open\') and (`o`.`created_at` > \'2026-01-01\'))', { table: 'o', estimatedRows: 10 })

    expect(adviseQueryPlan(plan('mysql', node), 'select * from orders o where o.status = \'open\'')).toEqual([
      expect.objectContaining({ kind: 'add_index', table: 'orders', columns: ['status', 'created_at'], sql: 'CREATE INDEX idx_orders_status_created_at ON orders (status, created_at);' })
    ])
  })

  it('suggests statistics when the estimate was far off, and an index for a large sort by plain columns', () => {
    const root: QueryPlanNode = {
      operation: 'Sort', sortKeys: ['created_at DESC'], estimatedRows: 50, actualRows: 4000, warnings: ['sort', 'misestimate'],
      children: [{ operation: 'Seq Scan', table: 'events', estimatedRows: 50, actualRows: 4000, warnings: ['misestimate'], children: [] }]
    }
    const advice = adviseQueryPlan({ ...plan('postgres', root), analyzed: true }, 'select * from events order by created_at desc')

    expect(advice).toContainEqual(expect.objectContaining({ kind: 'index_for_sort', table: 'events', columns: ['created_at'] }))
    expect(advice).toContainEqual({ kind: 'update_statistics', table: 'events', sql: 'ANALYZE events;' })
    expect(advice).toContainEqual({ kind: 'reduce_rows', rows: 4000 })
  })

  it('reads conditions in each database\'s own style', () => {
    expect(parseConditionColumns('((status)::text = \'open\'::text)')).toEqual([{ column: 'status', operator: '=', value: '\'open\'' }])
    expect(parseConditionColumns('[db].[dbo].[big].[label] like &apos;a%&apos;')).toEqual([{ table: 'big', column: 'label', operator: 'like', value: '\'a%\'' }])
    expect(parseConditionColumns('CONVERT_IMPLICIT(int,[Expr1005],0) > 1')).toEqual([])
  })

  it('reads aliases and quotes names only when needed', () => {
    expect(Object.fromEntries(readTableAliases('select * from public.orders as o join "Line Items" li on li.order_id = o.id where 1=1'))).toEqual({ orders: 'orders', o: 'orders', 'line items': 'Line Items', li: 'Line Items' })
    expect(createIndexSql('mssql', 'Line Items', [{ name: 'Order Id' }])).toBe('CREATE INDEX idx_line_items_order_id ON [Line Items] ([Order Id]);')
  })
})

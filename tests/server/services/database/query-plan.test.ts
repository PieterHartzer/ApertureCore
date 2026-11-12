import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import {
  normalizeMySqlAnalyzeTree,
  normalizeMySqlPlan,
  normalizePostgresPlan,
  normalizeSqlServerPlan,
  parseXml
} from '../../../../server/services/database/query-plan'
import type { QueryPlanNode } from '../../../../server/types/database'

// Real output from each engine for the same query on a 5,000-row table:
//   select grp, count(*) from big where label like 'a%' group by grp order by 2 desc
const fixture = (name: string) => readFileSync(`tests/server/services/database/fixtures/plans/${name}`, 'utf8')

const flatten = (node: QueryPlanNode): QueryPlanNode[] => [node, ...node.children.flatMap(flatten)]
const scanOf = (root: QueryPlanNode) => flatten(root).find(node => node.warnings.includes('full_scan'))
const warningsOf = (root: QueryPlanNode) => [...new Set(flatten(root).flatMap(node => node.warnings))].sort()

describe('query plans from every database', () => {
  it.each([
    ['PostgreSQL', () => normalizePostgresPlan(fixture('pg.json')), ['full_scan']],
    ['MySQL', () => normalizeMySqlPlan(fixture('mysql.json')), ['full_scan', 'sort', 'temporary_table']],
    ['MariaDB', () => normalizeMySqlPlan(fixture('mariadb.json')), ['full_scan', 'sort', 'temporary_table']],
    ['SQL Server', () => normalizeSqlServerPlan(fixture('mssql.xml'), false), ['full_scan', 'sort']]
  ])('finds the full scan of the table in %s estimates', (_engine, read, warnings) => {
    const root = read()

    expect(scanOf(root)?.object).toMatch(/^big\b/)
    expect(warningsOf(root)).toEqual(warnings)
    expect(flatten(root).every(node => node.actualRows === undefined)).toBe(true)
  })

  it.each([
    ['PostgreSQL', () => normalizePostgresPlan(fixture('pg-analyze.json'))],
    ['MySQL', () => normalizeMySqlAnalyzeTree(fixture('mysql-analyze.txt'))],
    ['MariaDB', () => normalizeMySqlPlan(fixture('mariadb-analyze.json'))],
    ['SQL Server', () => normalizeSqlServerPlan(fixture('mssql-analyze.xml'), true)]
  ])('reports real rows and time when %s ran the query', (_engine, read) => {
    const root = read()
    const scan = scanOf(root)!

    expect(scan.object).toMatch(/^big\b/)
    expect(scan.actualRows).toBeGreaterThan(0)
    expect(flatten(root).some(node => (node.timeMs ?? 0) > 0)).toBe(true)
  })

  it('counts PostgreSQL rows and time across loops', () => {
    const root = normalizePostgresPlan([{ Plan: { 'Node Type': 'Nested Loop', 'Join Type': 'Inner', 'Plans': [{ 'Node Type': 'Index Scan', 'Relation Name': 'orders', 'Index Name': 'orders_pkey', 'Plan Rows': 1, 'Actual Rows': 2, 'Actual Total Time': 0.5, 'Actual Loops': 400 }] } }])

    expect(root.operation).toBe('Nested Loop (Inner)')
    expect(root.children[0]).toMatchObject({ object: 'orders using orders_pkey', actualRows: 800, timeMs: 200, loops: 400, warnings: ['misestimate'] })
  })

  it('reads the MySQL ANALYZE tree by its indentation', () => {
    const root = normalizeMySqlAnalyzeTree(fixture('mysql-analyze.txt'))

    expect(root.operation).toBe('Sort')
    expect(flatten(root).map(node => node.operation)).toEqual(['Sort', 'Table scan', 'Aggregate using temporary table', 'Filter', 'Table scan'])
  })

  it('refuses output that holds no plan', () => {
    expect(() => normalizePostgresPlan('[]')).toThrow()
    expect(() => normalizeMySqlPlan('{}')).toThrow()
    expect(() => normalizeMySqlAnalyzeTree('nothing here')).toThrow()
    expect(() => normalizeSqlServerPlan('<ShowPlanXML/>', false)).toThrow()
  })

  it('reads XML attributes, entities and nesting', () => {
    const document = parseXml('<?xml version="1.0"?><a x="1 &lt; 2 &amp; &#65;"><b/><c><d y=\'q\'></d></c><!-- <e/> --></a>')
    const a = document.children[0]!

    expect(a.attributes.x).toBe('1 < 2 & A')
    expect(a.children.map(child => child.name)).toEqual(['b', 'c'])
    expect(a.children[1]!.children[0]!.attributes.y).toBe('q')
  })
})

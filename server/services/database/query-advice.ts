import type { QueryAdvice, QueryPlan, QueryPlanMissingIndex, QueryPlanNode } from '../../types/database'

/**
 * Turns a plan into concrete ways to make the query faster: an exact CREATE
 * INDEX where an index would help, and what to do instead where it can't.
 * Everything is worked out from the database's own condition text, so no
 * guesses are sent anywhere. The customer runs any statement themselves;
 * this app only ever reads.
 */

const NOTABLE_ROWS = 1000
const MAX_INDEX_COLUMNS = 3

type Engine = QueryPlan['engine']

interface Comparison {
  table?: string
  column: string
  operator: string
  value: string
  func?: string
}

const NOT_COLUMNS = new Set(['and', 'or', 'not', 'null', 'true', 'false', 'is', 'like', 'in', 'between', 'case', 'when', 'then', 'else', 'end', 'now', 'current_date', 'current_timestamp', 'interval', 'exists', 'select', 'any', 'all'])
// Casts and conversions say nothing about how the column is searched.
const NEUTRAL_FUNCTIONS = new Set(['convert_implicit', 'cast', 'convert'])

const unquote = (part: string) => part.replace(/^[`"[]|[`"\]]$/g, '')

// A plain name, or any text inside "quotes", `backticks` or [brackets].
const IDENTIFIER = String.raw`(?:"[^"]+"|\`[^\`]+\`|\[[^\]]+\]|[A-Za-z_][\w$]*)`
const QUALIFIED = String.raw`${IDENTIFIER}(?:\.${IDENTIFIER})*`
const COMPARISON = new RegExp(String.raw`(?:\b([A-Za-z_]\w*)\(\s*)?(${QUALIFIED})\s*\)?\s*(=|<>|!=|<=|>=|<|>|~~\*|!~~|~~|\bnot\s+like\b|\bilike\b|\blike\b|\bin\b|\bbetween\b)\s*('(?:[^']|'')*'|[^\s)]+)`, 'gi')

/** The column comparisons in a condition, as the database printed it. */
export const parseConditionColumns = (condition: string): Comparison[] => {
  let text = condition
    .replace(/::(?:character varying|double precision|timestamp(?: with(?:out)? time zone)?|[\w"]+)(?:\[\])?/gi, '')
    .replace(/&apos;/g, '\'')

  // Unwrap parentheses around a lone identifier: ((status)) = ... becomes status = ...
  for (let previous = ''; previous !== text;) {
    previous = text
    text = text.replace(/(?<![\w$])\(\s*([\w$."`[\]]+)\s*\)/g, '$1')
  }

  const comparisons: Comparison[] = []

  for (const match of text.matchAll(COMPARISON)) {
    const [, func, identifier = '', operator = '', value = ''] = match
    const parts = identifier.split('.').map(unquote)
    const column = parts[parts.length - 1] ?? ''

    if (!column || NOT_COLUMNS.has(column.toLowerCase()) || /^\d/.test(column)) continue

    comparisons.push({
      column,
      operator: operator.toLowerCase().replace(/\s+/g, ' '),
      value,
      ...(parts.length >= 2 ? { table: parts[parts.length - 2] } : {}),
      ...(func && !NEUTRAL_FUNCTIONS.has(func.toLowerCase()) ? { func: func.toLowerCase() } : {})
    })
  }

  return comparisons
}

const isLike = (operator: string) => operator === 'like' || operator === 'ilike' || operator === '~~' || operator === '~~*'
const isLeadingWildcard = (comparison: Comparison) => isLike(comparison.operator) && /^'[%_]/.test(comparison.value)
const isEquality = (operator: string) => operator === '=' || operator === 'in'

/** Maps aliases in the SQL to their tables: "from orders o" gives o → orders. */
export const readTableAliases = (sql: string) => {
  const aliases = new Map<string, string>()
  const pattern = new RegExp(String.raw`\b(?:from|join)\s+(${QUALIFIED})(?:\s+(?:as\s+)?(${IDENTIFIER}))?`, 'gi')

  for (const [, qualified = '', alias] of sql.matchAll(pattern)) {
    const table = unquote(qualified.split('.').pop() ?? '')

    if (!table) continue

    aliases.set(table.toLowerCase(), table)

    const name = alias && unquote(alias)

    if (name && !NOT_COLUMNS.has(name.toLowerCase()) && !/^(where|on|left|right|inner|outer|full|cross|join|group|order|limit|having|union|natural|using|with)$/i.test(name)) {
      aliases.set(name.toLowerCase(), table)
    }
  }

  return aliases
}

const quote = (engine: Engine, name: string) => {
  if (/^[a-z_][a-z0-9_]*$/.test(name)) return name

  return engine === 'mssql' ? `[${name}]` : engine === 'postgres' ? `"${name.replace(/"/g, '""')}"` : `\`${name.replace(/`/g, '``')}\``
}

const indexName = (table: string, columns: string[]) => `idx_${[table, ...columns].join('_')}`.replace(/\W+/g, '_').replace(/_+/g, '_').slice(0, 60).toLowerCase()

/** One CREATE INDEX statement in the engine's own syntax. */
export const createIndexSql = (engine: Engine, table: string, columns: Array<{ name: string, prefixSearch?: boolean, expression?: string }>, include: string[] = [], schema?: string) => {
  const name = indexName(table, columns.map(column => column.expression ? `${column.expression}_${column.name}` : column.name))
  const target = schema && engine === 'mssql' ? `${quote(engine, schema)}.${quote(engine, table)}` : quote(engine, table)
  const list = columns.map((column) => {
    if (column.expression) return `(${column.expression}(${quote(engine, column.name)}))`

    // PostgreSQL only uses an ordinary index for LIKE 'abc%' with this operator class (unless the database collation is C).
    return engine === 'postgres' && column.prefixSearch ? `${quote(engine, column.name)} text_pattern_ops` : quote(engine, column.name)
  }).join(', ')
  const includeList = include.length ? ` INCLUDE (${include.map(column => quote(engine, column)).join(', ')})` : ''

  // CONCURRENTLY builds the index without blocking writes to the table.
  return engine === 'postgres'
    ? `CREATE INDEX CONCURRENTLY ${name} ON ${target} (${list})${includeList};`
    : `CREATE INDEX ${name} ON ${target} (${list})${includeList};`
}

const statisticsSql = (engine: Engine, table: string) => {
  if (engine === 'postgres') return `ANALYZE ${quote(engine, table)};`
  if (engine === 'mssql') return `UPDATE STATISTICS ${quote(engine, table)};`

  return `ANALYZE TABLE ${quote(engine, table)};`
}

const flatten = (node: QueryPlanNode): QueryPlanNode[] => [node, ...node.children.flatMap(flatten)]

const missingIndexAdvice = (engine: Engine, index: QueryPlanMissingIndex): QueryAdvice => {
  const columns = [...index.equality, ...index.inequality]

  return {
    kind: 'add_index',
    table: index.table,
    columns,
    sql: createIndexSql(engine, index.table, columns.map(name => ({ name })), index.include, index.schema),
    ...(index.impact !== undefined ? { impact: Math.round(index.impact) } : {}),
    fromDatabase: true
  }
}

/** Concrete suggestions for a plan, most expensive steps first. */
export const adviseQueryPlan = (plan: QueryPlan, sql: string): QueryAdvice[] => {
  const aliases = readTableAliases(sql)
  const resolve = (name: string | undefined) => name ? aliases.get(name.toLowerCase()) ?? name : undefined
  const root = plan.root
  const weight = (node: QueryPlanNode) => (plan.analyzed ? node.timeMs : node.cost) ?? 0
  const nodes = flatten(root).sort((left, right) => weight(right) - weight(left))
  const tables = new Set(nodes.flatMap(node => node.table && !node.table.startsWith('<') ? [resolve(node.table)!] : []))
  const advice: QueryAdvice[] = (plan.missingIndexes ?? []).map(index => missingIndexAdvice(plan.engine, index))
  const suggestedTables = new Set(advice.map(item => item.table?.toLowerCase()))
  const seen = new Set<string>()
  const add = (item: QueryAdvice) => {
    const key = `${item.kind}:${item.table ?? ''}:${(item.columns ?? []).join(',')}`

    if (seen.has(key)) return

    seen.add(key)
    advice.push(item)
  }

  for (const node of nodes) {
    const rows = Math.max(node.actualRows ?? 0, node.estimatedRows ?? 0)

    if (node.warnings.includes('full_scan') && node.condition) {
      const comparisons = parseConditionColumns(node.condition)
      const tableOf = (comparison: Comparison) => resolve(comparison.table ?? node.table)

      for (const comparison of comparisons.filter(isLeadingWildcard)) {
        add({ kind: 'leading_wildcard', table: tableOf(comparison), columns: [comparison.column] })
      }

      for (const comparison of comparisons.filter(item => item.func && !isLeadingWildcard(item))) {
        const table = tableOf(comparison)

        add({
          kind: 'function_on_column',
          table,
          columns: [`${comparison.func}(${comparison.column})`],
          // SQL Server indexes expressions only through computed columns.
          ...(table && plan.engine !== 'mssql' ? { sql: createIndexSql(plan.engine, table, [{ name: comparison.column, expression: comparison.func }]) } : {})
        })
      }

      const indexable = comparisons.filter(item => !item.func && !isLeadingWildcard(item) && !item.operator.startsWith('not') && item.operator !== '<>' && item.operator !== '!=')
      const byTable = new Map<string, Comparison[]>()

      for (const comparison of indexable) {
        const table = tableOf(comparison)

        if (table) byTable.set(table, [...(byTable.get(table) ?? []), comparison])
      }

      for (const [table, list] of byTable) {
        // The database already named the index it wants for this table.
        if (suggestedTables.has(table.toLowerCase())) continue

        // Equality columns first, then one range or prefix search: the order an index can use.
        const ordered = [...list.filter(item => isEquality(item.operator)), ...list.filter(item => !isEquality(item.operator)).slice(0, 1)]
        const columns = [...new Map(ordered.map(item => [item.column.toLowerCase(), item])).values()].slice(0, MAX_INDEX_COLUMNS)

        add({
          kind: 'add_index',
          table,
          columns: columns.map(item => item.column),
          sql: createIndexSql(plan.engine, table, columns.map(item => ({ name: item.column, prefixSearch: isLike(item.operator) }))),
          rows
        })
      }
    }

    if (node.warnings.includes('sort') && node.sortKeys?.length && rows >= NOTABLE_ROWS) {
      // Only plain columns can come from an index; sorting by count(*) or an expression can't.
      const keys = node.sortKeys.map(key => key.trim().replace(/\s+(asc|desc)(\s+nulls\s+(first|last))?$/i, ''))
      const plain = keys.every(key => new RegExp(String.raw`^${QUALIFIED}$`).test(key))
      const parts = keys.map(key => key.split('.').map(unquote))
      const table = resolve(parts[0]!.length > 1 ? parts[0]![parts[0]!.length - 2] : tables.size === 1 ? [...tables][0] : undefined)

      if (plain && table && !suggestedTables.has(table.toLowerCase())) {
        const columns = parts.map(part => part[part.length - 1]!).slice(0, MAX_INDEX_COLUMNS)

        add({ kind: 'index_for_sort', table, columns, sql: createIndexSql(plan.engine, table, columns.map(name => ({ name }))), rows })
      }
    }

    if (node.warnings.includes('misestimate') && node.table && !node.table.startsWith('<')) {
      const table = resolve(node.table)!

      add({ kind: 'update_statistics', table, sql: statisticsSql(plan.engine, table) })
    }
  }

  const returned = root.actualRows ?? root.estimatedRows ?? 0

  if (returned >= NOTABLE_ROWS) add({ kind: 'reduce_rows', rows: Math.round(returned) })

  return advice
}

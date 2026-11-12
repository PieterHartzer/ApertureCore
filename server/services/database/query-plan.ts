import type { QueryPlanMissingIndex, QueryPlanNode, QueryPlanWarning } from '../../types/database'

/**
 * Turns each database's own EXPLAIN output into one plan tree, so every
 * adapter shows plans the same way. Rows below this are too few to matter.
 */
const NOTABLE_ROWS = 1000
const MAX_RAW_LENGTH = 200_000

export const truncateRawPlan = (raw: string) => raw.length > MAX_RAW_LENGTH ? `${raw.slice(0, MAX_RAW_LENGTH)}\n…` : raw

const toNumber = (value: unknown) => {
  const number = typeof value === 'number' ? value : typeof value === 'string' ? Number.parseFloat(value) : Number.NaN

  return Number.isFinite(number) ? number : undefined
}

const node = (operation: string, extra: Partial<QueryPlanNode> = {}): QueryPlanNode => ({
  operation,
  warnings: [],
  children: [],
  ...extra
})

const warn = (target: QueryPlanNode, warning: QueryPlanWarning) => {
  if (!target.warnings.includes(warning)) target.warnings.push(warning)
}

const withCondition = (condition: unknown) => typeof condition === 'string' && condition ? { condition } : {}
const withSortKeys = (keys: unknown) => {
  const list = Array.isArray(keys) ? keys.filter((key): key is string => typeof key === 'string') : typeof keys === 'string' ? [keys] : []

  return list.length ? { sortKeys: list } : {}
}

const rowsOf = (target: QueryPlanNode) => Math.max(target.actualRows ?? 0, target.estimatedRows ?? 0)

/** Flags steps whose real row count was far from the estimate. */
const markMisestimates = (target: QueryPlanNode) => {
  const { estimatedRows: estimate, actualRows: actual } = target

  if (estimate !== undefined && actual !== undefined) {
    const high = Math.max(estimate, actual)
    const low = Math.max(Math.min(estimate, actual), 1)

    if (high >= 100 && high / low >= 10) warn(target, 'misestimate')
  }

  target.children.forEach(markMisestimates)

  return target
}

// ---------------------------------------------------------------- PostgreSQL

interface PostgresPlanNode {
  'Node Type'?: string
  'Join Type'?: string
  'Strategy'?: string
  'Relation Name'?: string
  'Index Name'?: string
  'Plan Rows'?: number
  'Total Cost'?: number
  'Actual Rows'?: number
  'Actual Total Time'?: number
  'Actual Loops'?: number
  'Sort Method'?: string
  'Filter'?: string
  'Index Cond'?: string
  'Join Filter'?: string
  'Hash Cond'?: string
  'Merge Cond'?: string
  'Sort Key'?: string[]
  'Group Key'?: string[]
  'Rows Removed by Filter'?: number
  'Plans'?: PostgresPlanNode[]
}

const convertPostgresNode = (source: PostgresPlanNode): QueryPlanNode => {
  const type = source['Node Type'] ?? 'Step'
  const qualifier = source['Join Type'] ?? (source.Strategy && source.Strategy !== 'Plain' ? source.Strategy : '')
  const loops = toNumber(source['Actual Loops'])
  const actualRows = toNumber(source['Actual Rows'])
  const time = toNumber(source['Actual Total Time'])
  const relation = source['Relation Name']
  const target = node(qualifier ? `${type} (${qualifier})` : type, {
    object: relation ? (source['Index Name'] ? `${relation} using ${source['Index Name']}` : relation) : source['Index Name'],
    ...(relation ? { table: relation } : {}),
    ...withCondition(source.Filter ?? source['Join Filter'] ?? source['Hash Cond'] ?? source['Merge Cond'] ?? source['Index Cond']),
    ...withSortKeys(source['Sort Key'] ?? source['Group Key']),
    estimatedRows: toNumber(source['Plan Rows']),
    cost: toNumber(source['Total Cost']),
    // PostgreSQL reports rows and time per loop.
    ...(actualRows !== undefined ? { actualRows: actualRows * (loops ?? 1) } : {}),
    ...(time !== undefined ? { timeMs: time * (loops ?? 1) } : {}),
    ...(loops !== undefined ? { loops } : {}),
    children: (source.Plans ?? []).map(convertPostgresNode)
  })

  // A filtered scan reads the whole table to keep a few rows: the classic missing index.
  const rowsRead = (target.actualRows ?? 0) + (toNumber(source['Rows Removed by Filter']) ?? 0) * (loops ?? 1)

  if (type === 'Seq Scan' && (source.Filter || rowsOf(target) >= NOTABLE_ROWS || rowsRead >= NOTABLE_ROWS)) warn(target, 'full_scan')
  if ((type === 'Sort' || type === 'Incremental Sort') && (rowsOf(target) >= NOTABLE_ROWS || /external/i.test(source['Sort Method'] ?? ''))) warn(target, 'sort')

  return target
}

/** Reads `EXPLAIN (FORMAT JSON)` output. */
export const normalizePostgresPlan = (output: unknown): QueryPlanNode => {
  const document = typeof output === 'string' ? JSON.parse(output) : output
  const plan = (Array.isArray(document) ? document[0] : document)?.Plan as PostgresPlanNode | undefined

  if (!plan) throw new Error('The database returned no plan.')

  return markMisestimates(convertPostgresNode(plan))
}

// ---------------------------------------------------------------- MySQL and MariaDB (JSON)

type JsonObject = Record<string, unknown>

const isObject = (value: unknown): value is JsonObject => typeof value === 'object' && value !== null && !Array.isArray(value)

const ACCESS_TYPES: Record<string, string> = {
  ALL: 'Full table scan',
  index: 'Full index scan',
  range: 'Index range scan',
  ref: 'Index lookup',
  eq_ref: 'Unique index lookup',
  ref_or_null: 'Index lookup',
  index_merge: 'Index merge',
  fulltext: 'Full-text search',
  const: 'Constant lookup',
  system: 'Constant lookup'
}

const BLOCKS: Record<string, string> = {
  query_block: 'Query',
  nested_loop: 'Nested loop join',
  ordering_operation: 'Order',
  grouping_operation: 'Group',
  duplicates_removal: 'Remove duplicates',
  windowing: 'Window',
  union_result: 'Union',
  materialized_from_subquery: 'Materialized subquery',
  attached_subqueries: 'Subquery',
  optimized_away_subqueries: 'Subquery',
  read_sorted_file: 'Sorted read',
  filesort: 'Sort',
  temporary_table: 'Temporary table',
  having_subqueries: 'Subquery'
}

const tableNode = (table: JsonObject): QueryPlanNode => {
  const accessType = String(table.access_type ?? '')
  const name = String(table.table_name ?? table.alias ?? 'table')
  const key = typeof table.key === 'string' ? table.key : undefined
  const costInfo = isObject(table.cost_info) ? table.cost_info : {}
  const loops = toNumber(table.r_loops)
  const realRows = toNumber(table.r_rows)
  // MariaDB 11 splits a table's time into reading and the rest.
  const time = toNumber(table.r_total_time_ms) ?? (table.r_table_time_ms === undefined ? undefined : (toNumber(table.r_table_time_ms) ?? 0) + (toNumber(table.r_other_time_ms) ?? 0))
  const target = node(ACCESS_TYPES[accessType] ?? (accessType ? `Access (${accessType})` : 'Read'), {
    object: key ? `${name} using ${key}` : name,
    table: name,
    ...withCondition(table.attached_condition),
    estimatedRows: toNumber(table.rows_examined_per_scan ?? table.rows),
    cost: toNumber(costInfo.prefix_cost ?? costInfo.read_cost ?? table.cost),
    // MariaDB's ANALYZE reports rows per loop.
    ...(realRows !== undefined ? { actualRows: realRows * (loops ?? 1) } : {}),
    ...(time !== undefined ? { timeMs: time } : {}),
    ...(loops !== undefined ? { loops } : {}),
    children: convertMySqlChildren(table)
  })

  if (accessType === 'ALL' && rowsOf(target) >= NOTABLE_ROWS) warn(target, 'full_scan')
  if (table.using_temporary_table === true) warn(target, 'temporary_table')
  if (table.using_filesort === true) warn(target, 'sort')

  return target
}

const convertMySqlValue = (key: string, value: unknown): QueryPlanNode[] => {
  if (key === 'table' && isObject(value)) return [tableNode(value)]

  if (Array.isArray(value)) {
    const items = value.flatMap(item => isObject(item) ? convertMySqlChildren(item, true) : [])

    // A join of a single table is just that table.
    return BLOCKS[key] && items.length > 1 ? [node(BLOCKS[key], { children: items })] : items
  }

  if (isObject(value) && BLOCKS[key]) return [convertMySqlBlock(key, value)]

  return []
}

/** Child steps of a JSON object. Inside an array, a lone query block is unwrapped. */
function convertMySqlChildren (source: JsonObject, inList = false): QueryPlanNode[] {
  return Object.entries(source).flatMap(([key, value]) => {
    if (inList && key === 'query_block' && isObject(value)) return convertMySqlChildren(value)

    return convertMySqlValue(key, value)
  })
}

function convertMySqlBlock (key: string, block: JsonObject): QueryPlanNode {
  const costInfo = isObject(block.cost_info) ? block.cost_info : {}
  const time = toNumber(block.r_total_time_ms)
  const target = node(BLOCKS[key] ?? key, {
    cost: toNumber(costInfo.query_cost ?? costInfo.sort_cost ?? block.cost),
    ...(time !== undefined ? { timeMs: time } : {}),
    ...withSortKeys(block.sort_key),
    children: convertMySqlChildren(block)
  })

  if (block.using_filesort === true || key === 'filesort') warn(target, 'sort')
  if (block.using_temporary_table === true || key === 'temporary_table') warn(target, 'temporary_table')

  return target
}

/** Reads `EXPLAIN FORMAT=JSON` (MySQL, MariaDB) and MariaDB's `ANALYZE FORMAT=JSON`. */
export const normalizeMySqlPlan = (output: unknown): QueryPlanNode => {
  const document = typeof output === 'string' ? JSON.parse(output) : output

  if (!isObject(document) || !isObject(document.query_block)) throw new Error('The database returned no plan.')

  const root = convertMySqlBlock('query_block', document.query_block)

  // A query block with a single step reads more simply as that step.
  return markMisestimates(root.children.length === 1 && root.cost === undefined ? root.children[0]! : root)
}

// ---------------------------------------------------------------- MySQL EXPLAIN ANALYZE (tree text)

const TREE_LINE = /^(\s*)-> (.*?)(?:\s+\(cost=([\d.e+]+)(?:\.\.([\d.e+]+))? rows=([\d.e+]+)\))?(?:\s+\(actual time=([\d.e+]+)\.\.([\d.e+]+) rows=([\d.e+]+) loops=(\d+)\))?\s*$/

/** Reads MySQL's `EXPLAIN ANALYZE`, which is an indented text tree. */
export const normalizeMySqlAnalyzeTree = (output: string): QueryPlanNode => {
  const stack: Array<{ indent: number, target: QueryPlanNode }> = []
  let root: QueryPlanNode | null = null

  for (const line of output.split('\n')) {
    const match = TREE_LINE.exec(line)

    if (!match) continue

    const [, indent = '', text = '', , cost, estimate, , endTime, actual, loops] = match
    const loopCount = toNumber(loops)
    const tableName = / on (\S+)/.exec(text)?.[1]
    const detail = /^(?:Filter|Sort|Group[^:]*): (.*)$/.exec(text)?.[1]
    const target = node(text.replace(/:.*$/, '').replace(/ on \S+.*$/, '').trim() || text, {
      ...(tableName ? { object: tableName, ...(tableName.startsWith('<') ? {} : { table: tableName }) } : {}),
      ...(/^Filter:/.test(text) ? withCondition(detail) : {}),
      ...(/^Sort:/.test(text) && detail ? withSortKeys(detail.split(/,\s*/)) : {}),
      estimatedRows: toNumber(estimate),
      cost: toNumber(cost),
      ...(actual !== undefined ? { actualRows: (toNumber(actual) ?? 0) * (loopCount ?? 1) } : {}),
      ...(endTime !== undefined ? { timeMs: (toNumber(endTime) ?? 0) * (loopCount ?? 1) } : {}),
      ...(loopCount !== undefined ? { loops: loopCount } : {})
    })

    if (/^Table scan/i.test(text) && rowsOf(target) >= NOTABLE_ROWS) warn(target, 'full_scan')
    if (/^Sort\b/i.test(text)) warn(target, 'sort')
    if (/temporary/i.test(text)) warn(target, 'temporary_table')

    while (stack.length && stack[stack.length - 1]!.indent >= indent.length) stack.pop()

    if (stack.length) stack[stack.length - 1]!.target.children.push(target)
    else root ??= target

    stack.push({ indent: indent.length, target })
  }

  if (!root) throw new Error('The database returned no plan.')

  return markMisestimates(root)
}

// ---------------------------------------------------------------- SQL Server (showplan XML)

interface XmlElement {
  name: string
  attributes: Record<string, string>
  children: XmlElement[]
}

const XML_ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: '\'' }
const decodeXml = (value: string) => value.replace(/&(amp|lt|gt|quot|apos|#\d+|#x[\da-f]+);/gi, (_, entity: string) => {
  if (entity[0] === '#') return String.fromCodePoint(entity[1]?.toLowerCase() === 'x' ? Number.parseInt(entity.slice(2), 16) : Number.parseInt(entity.slice(1), 10))

  return XML_ENTITIES[entity.toLowerCase()] ?? ''
})

/** Enough of an XML reader for showplan documents: elements and attributes, no text. */
export const parseXml = (xml: string): XmlElement => {
  const root: XmlElement = { name: '#document', attributes: {}, children: [] }
  const stack = [root]
  const tag = /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!\[CDATA\[[\s\S]*?\]\]>|<(\/?)([A-Za-z_][\w:.-]*)((?:\s+[\w:.-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>/g

  for (const match of xml.matchAll(tag)) {
    const [, closing, name, attributeText = '', selfClosing] = match

    if (!name) continue

    if (closing) {
      while (stack.length > 1 && stack.pop()!.name !== name) { /* close until the matching element */ }
      continue
    }

    const attributes: Record<string, string> = {}

    for (const [, key, double, single] of attributeText.matchAll(/([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
      attributes[key!] = decodeXml(double ?? single ?? '')
    }

    const element: XmlElement = { name, attributes, children: [] }

    stack[stack.length - 1]!.children.push(element)

    if (!selfClosing) stack.push(element)
  }

  return root
}

/** Elements below this one, not looking inside nested RelOp steps. */
const findOwn = (element: XmlElement, name: string, found: XmlElement[] = []): XmlElement[] => {
  for (const child of element.children) {
    if (child.name === name) found.push(child)
    if (child.name !== 'RelOp') findOwn(child, name, found)
  }

  return found
}

const findFirst = (element: XmlElement, name: string): XmlElement | undefined => {
  for (const child of element.children) {
    if (child.name === name) return child

    const nested = findFirst(child, name)

    if (nested) return nested
  }

  return undefined
}

const stripBrackets = (value: string | undefined) => value?.replace(/^\[|\]$/g, '')

const convertRelOp = (relOp: XmlElement, analyzed: boolean): QueryPlanNode => {
  const physical = relOp.attributes.PhysicalOp ?? 'Step'
  const logical = relOp.attributes.LogicalOp
  const object = findOwn(relOp, 'Object')[0]
  const table = stripBrackets(object?.attributes.Table)
  const index = stripBrackets(object?.attributes.Index)
  const counters = findOwn(relOp, 'RunTimeCountersPerThread')
  const sum = (key: string) => counters.reduce((total, counter) => total + (toNumber(counter.attributes[key]) ?? 0), 0)
  const estimateRows = toNumber(relOp.attributes.EstimateRows)
  const executions = toNumber(relOp.attributes.EstimateExecutions) ?? 1
  const predicate = findOwn(relOp, 'Predicate')[0] ?? findOwn(relOp, 'SeekPredicates')[0]
  const condition = predicate && findFirst(predicate, 'ScalarOperator')?.attributes.ScalarString
  const sortColumns = findOwn(relOp, 'OrderBy').flatMap(orderBy => findOwn(orderBy, 'ColumnReference')).map(column => stripBrackets(column.attributes.Column)!).filter(Boolean)
  const target = node(logical && logical !== physical ? `${physical} (${logical})` : physical, {
    ...(table ? { object: index ? `${table} using ${index}` : table, table } : {}),
    ...withCondition(condition),
    ...withSortKeys(sortColumns),
    estimatedRows: estimateRows === undefined ? undefined : estimateRows * executions,
    cost: toNumber(relOp.attributes.EstimatedTotalSubtreeCost),
    ...(analyzed && counters.length
      ? {
          actualRows: sum('ActualRows'),
          loops: sum('ActualExecutions'),
          ...(counters.some(counter => counter.attributes.ActualElapsedms !== undefined)
            ? { timeMs: Math.max(...counters.map(counter => toNumber(counter.attributes.ActualElapsedms) ?? 0)) }
            : {})
        }
      : {}),
    children: findOwn(relOp, 'RelOp').map(child => convertRelOp(child, analyzed))
  })

  const rowsRead = Math.max(
    toNumber(relOp.attributes.EstimatedRowsRead) ?? 0,
    toNumber(relOp.attributes.TableCardinality) ?? 0,
    sum('ActualRowsRead')
  )

  if (/^(Table Scan|Clustered Index Scan|Index Scan)$/.test(physical) && Math.max(rowsOf(target), rowsRead) >= NOTABLE_ROWS) warn(target, 'full_scan')
  if (physical === 'Sort') warn(target, 'sort')
  if (/Spool$/.test(physical)) warn(target, 'temporary_table')

  return target
}

/** The indexes SQL Server itself says are missing, from showplan XML. */
export const readSqlServerMissingIndexes = (xml: string): QueryPlanMissingIndex[] => {
  const groups: XmlElement[] = []
  const collect = (element: XmlElement) => {
    for (const child of element.children) {
      if (child.name === 'MissingIndexGroup') groups.push(child)
      else collect(child)
    }
  }

  collect(parseXml(xml))

  return groups.flatMap(group => group.children.filter(child => child.name === 'MissingIndex').map((index) => {
    const columns = (usage: string) => index.children
      .filter(columnGroup => columnGroup.name === 'ColumnGroup' && columnGroup.attributes.Usage === usage)
      .flatMap(columnGroup => columnGroup.children.map(column => stripBrackets(column.attributes.Name)!))
      .filter(Boolean)

    return {
      schema: stripBrackets(index.attributes.Schema),
      table: stripBrackets(index.attributes.Table) ?? '',
      equality: columns('EQUALITY'),
      inequality: columns('INEQUALITY'),
      include: columns('INCLUDE'),
      impact: toNumber(group.attributes.Impact)
    }
  }))
}

/** Reads SQL Server showplan XML (estimated, or actual from STATISTICS XML). */
export const normalizeSqlServerPlan = (xml: string, analyzed: boolean): QueryPlanNode => {
  const queryPlan = findFirst(parseXml(xml), 'QueryPlan')
  const relOp = queryPlan && findFirst(queryPlan, 'RelOp')

  if (!relOp) throw new Error('The database returned no plan.')

  return markMisestimates(convertRelOp(relOp, analyzed))
}

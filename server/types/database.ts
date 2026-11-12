export const SERVER_DATABASE_TYPES = ['postgres', 'mysql', 'mssql'] as const
export type DatabaseType = (typeof SERVER_DATABASE_TYPES)[number]

export const SERVER_DATABASE_SSL_MODES = ['disable', 'require'] as const
export type DatabaseSslMode = (typeof SERVER_DATABASE_SSL_MODES)[number]

export type TestDatabaseConnectionResultCode =
  | 'success'
  | 'unauthorized'
  | 'rate_limited'
  | 'invalid_input'
  | 'saved_connection_not_found'
  | 'unsupported_database_type'
  | 'authentication_failed'
  | 'database_not_found'
  | 'connection_failed'
  | 'timeout'
  | 'ssl_required'
  | 'privileged_role'
  | 'unexpected_error'

export interface TestDatabaseConnectionInput {
  connectionName: string
  databaseType: DatabaseType
  host: string
  port: number
  databaseName: string
  username: string
  password: string
  sslMode: DatabaseSslMode
  /** The vetted address to connect to, in place of looking the host up again. */
  connectAddress?: string
}

export type TestDatabaseConnectionField =
  | keyof TestDatabaseConnectionInput
  | 'connectionId'
  | 'body'

export type TestDatabaseConnectionValidationIssue =
  | 'body_invalid'
  | 'connection_id_invalid'
  | 'connection_name_invalid'
  | 'database_type_invalid'
  | 'host_required'
  | 'port_invalid'
  | 'database_name_required'
  | 'username_required'
  | 'password_required'
  | 'ssl_mode_invalid'

export interface TestDatabaseConnectionResult {
  ok: boolean
  code: TestDatabaseConnectionResultCode
  message: string
  details?: string
}

export interface TestDatabaseConnectionValidationError {
  ok: false
  code: 'invalid_input'
  issue: TestDatabaseConnectionValidationIssue
  message: string
  field?: TestDatabaseConnectionField
}

export interface TestDatabaseConnectionValidationSuccess {
  ok: true
  data: TestDatabaseConnectionInput
}

export type TestDatabaseConnectionValidationResult =
  | TestDatabaseConnectionValidationError
  | TestDatabaseConnectionValidationSuccess

export interface TestDatabaseConnectionApiResponse
  extends TestDatabaseConnectionResult {
  messageKey?: string
  issue?: TestDatabaseConnectionValidationIssue
  field?: TestDatabaseConnectionField
}

export interface ExecuteDatabaseReadOnlyQueryInput {
  databaseType: DatabaseType
  host: string
  port: number
  databaseName: string
  username: string
  password: string
  sslMode: DatabaseSslMode
  /** The vetted address to connect to, in place of looking the host up again. */
  connectAddress?: string
  sql: string
  maxRows?: number
  timeoutMs?: number
}

export type DatabaseQueryResultValue =
  | string
  | number
  | boolean
  | null

export interface DatabaseQueryResultRow {
  [column: string]: DatabaseQueryResultValue
}

export type ExecuteDatabaseReadOnlyQueryResultCode =
  | 'success'
  | 'unsupported_database_type'
  | 'authentication_failed'
  | 'database_not_found'
  | 'connection_failed'
  | 'timeout'
  | 'ssl_required'
  | 'query_rejected'
  | 'query_failed'
  | 'unexpected_error'

export type ExecuteDatabaseReadOnlyQueryResult =
  | {
      ok: true
      code: 'success'
      message: 'success'
      columns: string[]
      rows: DatabaseQueryResultRow[]
      rowLimit: number
    }
  | {
      ok: false
      code: Exclude<ExecuteDatabaseReadOnlyQueryResultCode, 'success'>
      message: Exclude<ExecuteDatabaseReadOnlyQueryResultCode, 'success'>
      details?: string
    }

/** Something in a plan step worth a closer look. */
export type QueryPlanWarning =
  /** Every row of a table is read. */
  | 'full_scan'
  /** Rows are sorted rather than read in order from an index. */
  | 'sort'
  /** The database built a temporary table. */
  | 'temporary_table'
  /** The real row count was far from the estimate, so the plan may be a poor one. */
  | 'misestimate'

/** One step of a query plan, the same shape for every database. */
export interface QueryPlanNode {
  operation: string
  /** The table or index the step reads, when it reads one. */
  object?: string
  estimatedRows?: number
  actualRows?: number
  /** The database's own cost figure for this step and everything below it. */
  cost?: number
  /** Time for this step and everything below it, when the query was run. */
  timeMs?: number
  loops?: number
  /** The real table name (not an alias), when the database says. */
  table?: string
  /** The condition this step applies to rows, as the database printed it. */
  condition?: string
  /** What this step sorts or groups by. */
  sortKeys?: string[]
  warnings: QueryPlanWarning[]
  children: QueryPlanNode[]
}

/** An index the database itself says would help (SQL Server reports these). */
export interface QueryPlanMissingIndex {
  schema?: string
  table: string
  equality: string[]
  inequality: string[]
  include: string[]
  /** The database's estimate of the improvement, in percent. */
  impact?: number
}

export type QueryAdviceKind =
  | 'add_index'
  | 'index_for_sort'
  | 'leading_wildcard'
  | 'function_on_column'
  | 'update_statistics'
  | 'reduce_rows'

/** One concrete way to make the query faster. */
export interface QueryAdvice {
  kind: QueryAdviceKind
  table?: string
  columns?: string[]
  /** Statement for a database administrator to run; this app only reads. */
  sql?: string
  impact?: number
  rows?: number
  /** Whether the database itself suggested this. */
  fromDatabase?: boolean
}

export interface QueryPlan {
  engine: 'postgres' | 'mysql' | 'mariadb' | 'mssql'
  /** True when the query was run to measure it, not only estimated. */
  analyzed: boolean
  root: QueryPlanNode
  /** The database's own output (JSON, XML or text), for anyone who wants every detail. */
  raw: string
  missingIndexes?: QueryPlanMissingIndex[]
  /** Concrete suggestions, slowest steps first. */
  advice?: QueryAdvice[]
}

export interface ExplainDatabaseQueryInput extends ExecuteDatabaseReadOnlyQueryInput {
  /** Run the query to measure real times and row counts. Read-only rules still apply. */
  analyze: boolean
}

export type ExplainDatabaseQueryResult =
  | { ok: true, code: 'success', message: 'success', plan: QueryPlan }
  | {
      ok: false
      code: Exclude<ExecuteDatabaseReadOnlyQueryResultCode, 'success'> | 'permission_denied'
      message: Exclude<ExecuteDatabaseReadOnlyQueryResultCode, 'success'> | 'permission_denied'
      details?: string
    }

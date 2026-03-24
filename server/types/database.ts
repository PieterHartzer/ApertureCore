export const SERVER_DATABASE_TYPES = ['postgres'] as const
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

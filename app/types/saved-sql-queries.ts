export interface SavedSqlQueryInput {
  queryName: string
  connectionId: string
  sql: string
}

export type SavedSqlQueryResultValue =
  | string
  | number
  | boolean
  | null

export interface SavedSqlQueryResultRow {
  [column: string]: SavedSqlQueryResultValue
}

export interface SavedSqlQueryConnectionOption {
  label: string
  value: string
}

export type SavedSqlQueryTestIssue =
  | 'body_invalid'
  | 'connection_id_invalid'
  | 'sql_invalid'
  | 'sql_required'

export interface SavedSqlQueryTestResponse {
  ok: boolean
  code:
    | 'success'
    | 'forbidden'
    | 'rate_limited'
    | 'invalid_input'
    | 'saved_connection_not_found'
    | 'unsupported_database_type'
    | 'authentication_failed'
    | 'database_not_found'
    | 'connection_failed'
    | 'timeout'
    | 'ssl_required'
    | 'query_rejected'
    | 'query_failed'
    | 'persistence_unavailable'
    | 'unexpected_error'
  message: string
  messageKey?: string
  details?: string
  field?: 'connectionId' | 'sql' | 'body'
  issue?: SavedSqlQueryTestIssue
  columns?: string[]
  rows?: SavedSqlQueryResultRow[]
  rowLimit?: number
}

export const createEmptySavedSqlQueryInput = (): SavedSqlQueryInput => ({
  queryName: '',
  connectionId: '',
  sql: ''
})

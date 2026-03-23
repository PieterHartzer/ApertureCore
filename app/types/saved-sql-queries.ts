export interface SavedSqlQueryInput {
  queryName: string
  connectionId: string
  sql: string
}

export interface SavedSqlQuerySummary {
  id: string
  queryName: string
  connectionId: string
  connectionName: string
  createdAt: string
  updatedAt: string
}

export interface SavedSqlQueryDetails extends SavedSqlQueryInput {
  id: string
  createdAt: string
  updatedAt: string
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

export type SavedSqlQueryGetIssue = 'query_id_invalid'

export interface SavedSqlQueryGetResponse {
  ok: boolean
  code:
    | 'success'
    | 'invalid_input'
    | 'forbidden'
    | 'not_found'
    | 'persistence_unavailable'
    | 'unexpected_error'
  message: string
  messageKey?: string
  field?: 'queryId'
  issue?: SavedSqlQueryGetIssue
  query?: SavedSqlQueryDetails
}

export type SavedSqlQuerySaveIssue =
  | 'body_invalid'
  | 'query_name_invalid'
  | 'query_name_required'
  | 'connection_id_invalid'
  | 'sql_invalid'
  | 'sql_required'
  | 'sql_too_long'
  | 'sql_invalid_characters'
  | 'sql_multiple_statements'
  | 'sql_not_read_only'

export interface SavedSqlQuerySaveResponse {
  ok: boolean
  code:
    | 'success'
    | 'forbidden'
    | 'invalid_input'
    | 'not_found'
    | 'duplicate_query_name'
    | 'persistence_unavailable'
    | 'unexpected_error'
  message: string
  messageKey?: string
  field?: keyof SavedSqlQueryInput | 'body'
  issue?: SavedSqlQuerySaveIssue
  query?: SavedSqlQuerySummary
}

export interface SavedSqlQueryUpdateResponse {
  ok: boolean
  code:
    | 'success'
    | 'forbidden'
    | 'invalid_input'
    | 'not_found'
    | 'duplicate_query_name'
    | 'persistence_unavailable'
    | 'unexpected_error'
  message: string
  messageKey?: string
  field?: keyof SavedSqlQueryInput | 'queryId' | 'body'
  issue?: SavedSqlQuerySaveIssue | SavedSqlQueryGetIssue
  query?: SavedSqlQuerySummary
}

export interface SavedSqlQueryDeleteRequest {
  confirmationName: string
}

export type SavedSqlQueryDeleteIssue =
  | 'body_invalid'
  | 'query_id_invalid'
  | 'confirmation_name_invalid'
  | 'confirmation_name_required'

export interface SavedSqlQueryDeleteResponse {
  ok: boolean
  code:
    | 'success'
    | 'forbidden'
    | 'invalid_input'
    | 'confirmation_mismatch'
    | 'not_found'
    | 'persistence_unavailable'
    | 'unexpected_error'
  message: string
  messageKey?: string
  field?: 'queryId' | 'confirmationName' | 'body'
  issue?: SavedSqlQueryDeleteIssue
}

export interface ListSavedSqlQueriesResponse {
  ok: boolean
  code:
    | 'success'
    | 'forbidden'
    | 'persistence_unavailable'
    | 'unexpected_error'
  message: string
  messageKey?: string
  queries?: SavedSqlQuerySummary[]
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

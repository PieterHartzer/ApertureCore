import type { AuthenticatedOrganizationContext } from './database-connections'

export type { AuthenticatedOrganizationContext }

export interface SavedSqlQuerySecret {
  sql: string
}

export interface SaveSavedSqlQueryInput {
  queryName: string
  connectionId: string
  sql: string
}

export interface TestSavedSqlQueryInput {
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

export type SavedSqlQueryResultValue =
  | string
  | number
  | boolean
  | null

export interface SavedSqlQueryResultRow {
  [column: string]: SavedSqlQueryResultValue
}

export type SaveSavedSqlQueryValidationIssue =
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

export type SaveSavedSqlQueryValidationError = {
  ok: false
  code: 'invalid_input'
  issue: SaveSavedSqlQueryValidationIssue
  message: string
  field?: keyof SaveSavedSqlQueryInput | 'body'
}

export type SaveSavedSqlQueryValidationResult =
  | {
      ok: true
      data: SaveSavedSqlQueryInput
    }
  | SaveSavedSqlQueryValidationError

export type TestSavedSqlQueryField =
  | keyof TestSavedSqlQueryInput
  | 'body'

export type TestSavedSqlQueryValidationIssue =
  | 'body_invalid'
  | 'connection_id_invalid'
  | 'sql_invalid'
  | 'sql_required'

export type TestSavedSqlQueryValidationError = {
  ok: false
  code: 'invalid_input'
  issue: TestSavedSqlQueryValidationIssue
  message: string
  field?: TestSavedSqlQueryField
}

export type TestSavedSqlQueryValidationResult =
  | {
      ok: true
      data: TestSavedSqlQueryInput
    }
  | TestSavedSqlQueryValidationError

export type SaveSavedSqlQueryResultCode =
  | 'success'
  | 'not_found'
  | 'duplicate_query_name'
  | 'persistence_unavailable'
  | 'unexpected_error'

export type SaveSavedSqlQueryResult =
  | {
      ok: true
      code: 'success'
      query: SavedSqlQuerySummary
    }
  | {
      ok: false
      code: Exclude<SaveSavedSqlQueryResultCode, 'success'>
      message: string
    }

export type TestSavedSqlQueryResultCode =
  | 'success'
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

export type TestSavedSqlQueryResult =
  | {
      ok: true
      code: 'success'
      columns: string[]
      rows: SavedSqlQueryResultRow[]
      rowLimit: number
    }
  | {
      ok: false
      code: Exclude<TestSavedSqlQueryResultCode, 'success'>
      message: string
      details?: string
    }

export interface SaveSavedSqlQueryApiResponse {
  ok: boolean
  code:
    | 'success'
    | 'forbidden'
    | 'invalid_input'
    | Exclude<SaveSavedSqlQueryResultCode, 'success'>
  message: string
  messageKey?: string
  field?: keyof SaveSavedSqlQueryInput | 'body'
  issue?: SaveSavedSqlQueryValidationIssue
  query?: SavedSqlQuerySummary
}

export interface TestSavedSqlQueryApiResponse {
  ok: boolean
  code:
    | 'success'
    | 'forbidden'
    | 'rate_limited'
    | 'invalid_input'
    | Exclude<TestSavedSqlQueryResultCode, 'success'>
  message: string
  messageKey?: string
  details?: string
  field?: TestSavedSqlQueryField
  issue?: TestSavedSqlQueryValidationIssue
  columns?: string[]
  rows?: SavedSqlQueryResultRow[]
  rowLimit?: number
}

export type ListSavedSqlQueriesResultCode =
  | 'success'
  | 'persistence_unavailable'
  | 'unexpected_error'

export type ListSavedSqlQueriesResult =
  | {
      ok: true
      code: 'success'
      queries: SavedSqlQuerySummary[]
    }
  | {
      ok: false
      code: Exclude<ListSavedSqlQueriesResultCode, 'success'>
      message: string
    }

export interface ListSavedSqlQueriesApiResponse {
  ok: boolean
  code:
    | 'success'
    | 'forbidden'
    | Exclude<ListSavedSqlQueriesResultCode, 'success'>
  message: string
  messageKey?: string
  queries?: SavedSqlQuerySummary[]
}

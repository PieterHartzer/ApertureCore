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

export interface SavedSqlQueryDetails {
  id: string
  queryName: string
  connectionId: string
  sql: string
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

export interface SavedSqlQueryIdValidationError {
  ok: false
  code: 'invalid_input'
  issue: 'query_id_invalid'
  message: string
  field: 'queryId'
}

export interface SavedSqlQueryIdValidationSuccess {
  ok: true
  data: {
    queryId: string
  }
}

export type SavedSqlQueryIdValidationResult =
  | SavedSqlQueryIdValidationError
  | SavedSqlQueryIdValidationSuccess

export interface GetSavedSqlQueryResultSuccess {
  ok: true
  code: 'success'
  query: SavedSqlQueryDetails
}

export interface SavedSqlQueryResultError<TCode extends string> {
  ok: false
  code: TCode
  message: string
}

export type GetSavedSqlQueryResultCode =
  | 'success'
  | 'not_found'
  | 'persistence_unavailable'
  | 'unexpected_error'

export type GetSavedSqlQueryResult =
  | GetSavedSqlQueryResultSuccess
  | SavedSqlQueryResultError<Exclude<GetSavedSqlQueryResultCode, 'success'>>

export interface GetSavedSqlQueryApiResponse {
  ok: boolean
  code:
    | 'success'
    | 'invalid_input'
    | 'forbidden'
    | Exclude<GetSavedSqlQueryResultCode, 'success'>
  message: string
  messageKey?: string
  field?: 'queryId'
  issue?: 'query_id_invalid'
  query?: SavedSqlQueryDetails
}

export interface UpdateSavedSqlQueryInput extends SaveSavedSqlQueryInput {
  queryId: string
}

export type UpdateSavedSqlQueryField =
  | keyof UpdateSavedSqlQueryInput
  | 'body'

export type UpdateSavedSqlQueryValidationIssue =
  | 'body_invalid'
  | 'query_id_invalid'
  | SaveSavedSqlQueryValidationIssue

export interface UpdateSavedSqlQueryValidationError {
  ok: false
  code: 'invalid_input'
  issue: UpdateSavedSqlQueryValidationIssue
  message: string
  field?: UpdateSavedSqlQueryField
}

export type UpdateSavedSqlQueryValidationResult =
  | {
      ok: true
      data: UpdateSavedSqlQueryInput
    }
  | UpdateSavedSqlQueryValidationError

export type UpdateSavedSqlQueryResultCode =
  | 'success'
  | 'not_found'
  | 'duplicate_query_name'
  | 'persistence_unavailable'
  | 'unexpected_error'

export type UpdateSavedSqlQueryResult =
  | {
      ok: true
      code: 'success'
      query: SavedSqlQuerySummary
    }
  | SavedSqlQueryResultError<Exclude<UpdateSavedSqlQueryResultCode, 'success'>>

export interface UpdateSavedSqlQueryApiResponse {
  ok: boolean
  code:
    | 'success'
    | 'invalid_input'
    | 'forbidden'
    | Exclude<UpdateSavedSqlQueryResultCode, 'success'>
  message: string
  messageKey?: string
  field?: UpdateSavedSqlQueryField
  issue?: UpdateSavedSqlQueryValidationIssue
  query?: SavedSqlQuerySummary
}

export interface DeleteSavedSqlQueryInput {
  queryId: string
  confirmationName: string
}

export type DeleteSavedSqlQueryField =
  | keyof DeleteSavedSqlQueryInput
  | 'body'

export type DeleteSavedSqlQueryValidationIssue =
  | 'body_invalid'
  | 'query_id_invalid'
  | 'confirmation_name_invalid'
  | 'confirmation_name_required'

export interface DeleteSavedSqlQueryValidationError {
  ok: false
  code: 'invalid_input'
  issue: DeleteSavedSqlQueryValidationIssue
  message: string
  field?: DeleteSavedSqlQueryField
}

export type DeleteSavedSqlQueryValidationResult =
  | {
      ok: true
      data: DeleteSavedSqlQueryInput
    }
  | DeleteSavedSqlQueryValidationError

export type DeleteSavedSqlQueryResultCode =
  | 'success'
  | 'confirmation_mismatch'
  | 'not_found'
  | 'persistence_unavailable'
  | 'unexpected_error'

export type DeleteSavedSqlQueryResult =
  | {
      ok: true
      code: 'success'
    }
  | SavedSqlQueryResultError<Exclude<DeleteSavedSqlQueryResultCode, 'success'>>

export interface DeleteSavedSqlQueryApiResponse {
  ok: boolean
  code:
    | 'success'
    | 'invalid_input'
    | 'forbidden'
    | Exclude<DeleteSavedSqlQueryResultCode, 'success'>
  message: string
  messageKey?: string
  field?: DeleteSavedSqlQueryField
  issue?: DeleteSavedSqlQueryValidationIssue
}

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
  | SavedSqlQueryResultError<Exclude<SaveSavedSqlQueryResultCode, 'success'>>

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

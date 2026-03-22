import type { AuthenticatedOrganizationContext } from './database-connections'

export type { AuthenticatedOrganizationContext }

export interface SavedSqlQuerySummary {
  id: string
  queryName: string
  connectionId: string
  connectionName: string
  createdAt: string
  updatedAt: string
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

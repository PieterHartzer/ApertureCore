import type {
  TestDatabaseConnectionInput,
  DatabaseType,
  DatabaseSslMode
} from './database'

export interface AuthenticatedOrganizationContext {
  userId: string
  organizationId: string
  organizationName: string
  organizationPrimaryDomain?: string
}

export interface SavedDatabaseConnectionSummary {
  id: string
  connectionName: string
  databaseType: DatabaseType
  createdAt: string
  updatedAt: string
}

export interface SavedDatabaseConnectionSecret {
  host: string
  port: number
  databaseName: string
  username: string
  password: string
  sslMode: DatabaseSslMode
}

export type SaveDatabaseConnectionInput = TestDatabaseConnectionInput

export type SaveDatabaseConnectionField =
  | keyof SaveDatabaseConnectionInput
  | 'body'

export type SaveDatabaseConnectionValidationIssue =
  | 'body_invalid'
  | 'connection_name_invalid'
  | 'connection_name_required'
  | 'database_type_invalid'
  | 'host_required'
  | 'port_invalid'
  | 'database_name_required'
  | 'username_required'
  | 'password_required'
  | 'ssl_mode_invalid'

export interface SaveDatabaseConnectionValidationError {
  ok: false
  code: 'invalid_input'
  issue: SaveDatabaseConnectionValidationIssue
  message: string
  field?: SaveDatabaseConnectionField
}

export interface SaveDatabaseConnectionValidationSuccess {
  ok: true
  data: SaveDatabaseConnectionInput
}

export type SaveDatabaseConnectionValidationResult =
  | SaveDatabaseConnectionValidationError
  | SaveDatabaseConnectionValidationSuccess

export type SaveDatabaseConnectionResultCode =
  | 'success'
  | 'duplicate_connection_name'
  | 'duplicate_connection_target'
  | 'persistence_unavailable'
  | 'unexpected_error'

export type SaveDatabaseConnectionResult =
  | {
      ok: true
      code: 'success'
      connection: SavedDatabaseConnectionSummary
    }
  | {
      ok: false
      code: Exclude<SaveDatabaseConnectionResultCode, 'success'>
      message: string
    }

export interface SaveDatabaseConnectionApiResponse {
  ok: boolean
  code:
    | 'success'
    | 'forbidden'
    | 'invalid_input'
    | Exclude<SaveDatabaseConnectionResultCode, 'success'>
  message: string
  messageKey?: string
  field?: SaveDatabaseConnectionField
  issue?: SaveDatabaseConnectionValidationIssue
  connection?: SavedDatabaseConnectionSummary
}

export type ListSavedDatabaseConnectionsResultCode =
  | 'success'
  | 'persistence_unavailable'
  | 'unexpected_error'

export type ListSavedDatabaseConnectionsResult =
  | {
      ok: true
      code: 'success'
      connections: SavedDatabaseConnectionSummary[]
    }
  | {
      ok: false
      code: Exclude<ListSavedDatabaseConnectionsResultCode, 'success'>
      message: string
    }

export interface ListSavedDatabaseConnectionsApiResponse {
  ok: boolean
  code:
    | 'success'
    | 'forbidden'
    | Exclude<ListSavedDatabaseConnectionsResultCode, 'success'>
  message: string
  messageKey?: string
  connections?: SavedDatabaseConnectionSummary[]
}

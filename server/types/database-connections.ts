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

export interface SavedDatabaseConnectionDetails {
  id: string
  connectionName: string
  databaseType: DatabaseType
  host: string
  port: number
  databaseName: string
  username: string
  sslMode: DatabaseSslMode
  hasPassword: boolean
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

export interface SavedDatabaseConnectionIdValidationError {
  ok: false
  code: 'invalid_input'
  issue: 'connection_id_invalid'
  message: string
  field: 'connectionId'
}

export interface SavedDatabaseConnectionIdValidationSuccess {
  ok: true
  data: {
    connectionId: string
  }
}

export type SavedDatabaseConnectionIdValidationResult =
  | SavedDatabaseConnectionIdValidationError
  | SavedDatabaseConnectionIdValidationSuccess

export type GetSavedDatabaseConnectionResultCode =
  | 'success'
  | 'not_found'
  | 'persistence_unavailable'
  | 'unexpected_error'

export type GetSavedDatabaseConnectionResult =
  | {
      ok: true
      code: 'success'
      connection: SavedDatabaseConnectionDetails
    }
  | {
      ok: false
      code: Exclude<GetSavedDatabaseConnectionResultCode, 'success'>
      message: string
    }

export interface GetSavedDatabaseConnectionApiResponse {
  ok: boolean
  code:
    | 'success'
    | 'invalid_input'
    | 'forbidden'
    | Exclude<GetSavedDatabaseConnectionResultCode, 'success'>
  message: string
  messageKey?: string
  field?: 'connectionId'
  issue?: 'connection_id_invalid'
  connection?: SavedDatabaseConnectionDetails
}

export interface UpdateDatabaseConnectionInput
  extends Omit<SaveDatabaseConnectionInput, 'password'> {
  connectionId: string
  password?: string
}

export type UpdateDatabaseConnectionField =
  | keyof UpdateDatabaseConnectionInput
  | 'body'

export type UpdateDatabaseConnectionValidationIssue =
  | 'body_invalid'
  | 'connection_id_invalid'
  | 'connection_name_invalid'
  | 'connection_name_required'
  | 'database_type_invalid'
  | 'host_required'
  | 'port_invalid'
  | 'database_name_required'
  | 'username_required'
  | 'password_required'
  | 'ssl_mode_invalid'

export interface UpdateDatabaseConnectionValidationError {
  ok: false
  code: 'invalid_input'
  issue: UpdateDatabaseConnectionValidationIssue
  message: string
  field?: UpdateDatabaseConnectionField
}

export interface UpdateDatabaseConnectionValidationSuccess {
  ok: true
  data: UpdateDatabaseConnectionInput
}

export type UpdateDatabaseConnectionValidationResult =
  | UpdateDatabaseConnectionValidationError
  | UpdateDatabaseConnectionValidationSuccess

export type UpdateDatabaseConnectionResultCode =
  | 'success'
  | 'not_found'
  | 'duplicate_connection_name'
  | 'duplicate_connection_target'
  | 'persistence_unavailable'
  | 'unexpected_error'

export type UpdateDatabaseConnectionResult =
  | {
      ok: true
      code: 'success'
      connection: SavedDatabaseConnectionSummary
    }
  | {
      ok: false
      code: Exclude<UpdateDatabaseConnectionResultCode, 'success'>
      message: string
    }

export interface UpdateDatabaseConnectionApiResponse {
  ok: boolean
  code:
    | 'success'
    | 'forbidden'
    | 'invalid_input'
    | Exclude<UpdateDatabaseConnectionResultCode, 'success'>
  message: string
  messageKey?: string
  field?: UpdateDatabaseConnectionField
  issue?: UpdateDatabaseConnectionValidationIssue
  connection?: SavedDatabaseConnectionSummary
}

export interface DeleteDatabaseConnectionInput {
  connectionId: string
  confirmationName: string
  deleteLinkedQueries: boolean
}

export type DeleteDatabaseConnectionField =
  | keyof DeleteDatabaseConnectionInput
  | 'body'

export type DeleteDatabaseConnectionValidationIssue =
  | 'body_invalid'
  | 'connection_id_invalid'
  | 'confirmation_name_invalid'
  | 'confirmation_name_required'
  | 'delete_linked_queries_invalid'

export interface DeleteDatabaseConnectionValidationError {
  ok: false
  code: 'invalid_input'
  issue: DeleteDatabaseConnectionValidationIssue
  message: string
  field?: DeleteDatabaseConnectionField
}

export interface DeleteDatabaseConnectionValidationSuccess {
  ok: true
  data: DeleteDatabaseConnectionInput
}

export type DeleteDatabaseConnectionValidationResult =
  | DeleteDatabaseConnectionValidationError
  | DeleteDatabaseConnectionValidationSuccess

export type DeleteDatabaseConnectionResultCode =
  | 'success'
  | 'confirmation_mismatch'
  | 'not_found'
  | 'persistence_unavailable'
  | 'unexpected_error'

export type DeleteDatabaseConnectionResult =
  | {
      ok: true
      code: 'success'
    }
  | {
      ok: false
      code: Exclude<DeleteDatabaseConnectionResultCode, 'success'>
      message: string
    }

export interface DeleteDatabaseConnectionApiResponse {
  ok: boolean
  code:
    | 'success'
    | 'forbidden'
    | 'invalid_input'
    | Exclude<DeleteDatabaseConnectionResultCode, 'success'>
  message: string
  messageKey?: string
  field?: DeleteDatabaseConnectionField
  issue?: DeleteDatabaseConnectionValidationIssue
}

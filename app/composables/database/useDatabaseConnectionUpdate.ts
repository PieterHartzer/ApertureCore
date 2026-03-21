import type { DatabaseConnection, DatabaseType } from '~/types/database'

interface SavedDatabaseConnectionSummary {
  id: string
  connectionName: string
  databaseType: DatabaseType
  createdAt: string
  updatedAt: string
}

type UpdateDatabaseConnectionResponse = {
  ok: boolean
  code:
    | 'success'
    | 'forbidden'
    | 'invalid_input'
    | 'not_found'
    | 'duplicate_connection_name'
    | 'duplicate_connection_target'
    | 'persistence_unavailable'
    | 'unexpected_error'
  message: string
  messageKey?: string
  field?: keyof DatabaseConnection | 'connectionId' | 'body'
  issue?:
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
  connection?: SavedDatabaseConnectionSummary
}

const createUnexpectedResponse = (): UpdateDatabaseConnectionResponse => ({
  ok: false,
  code: 'unexpected_error',
  message: 'connections.update.errors.unexpected',
  messageKey: 'connections.update.errors.unexpected'
})

const isUpdateConnectionResponse = (
  value: unknown
): value is UpdateDatabaseConnectionResponse => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'ok' in value &&
    'code' in value &&
    'message' in value
  )
}

export const useDatabaseConnectionUpdate = () => {
  const updateConnection = async (
    connectionId: string,
    connection: DatabaseConnection
  ): Promise<UpdateDatabaseConnectionResponse> => {
    try {
      return await $fetch<UpdateDatabaseConnectionResponse>(
        `/api/connections/${connectionId}`,
        {
          method: 'PUT',
          body: connection
        }
      )
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'data' in error &&
        isUpdateConnectionResponse(error.data)
      ) {
        return error.data
      }

      return createUnexpectedResponse()
    }
  }

  return {
    updateConnection
  }
}

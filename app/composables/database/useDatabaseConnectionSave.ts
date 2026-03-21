import type { DatabaseConnection, DatabaseType } from '~/types/database'

interface SavedDatabaseConnectionSummary {
  id: string
  connectionName: string
  databaseType: DatabaseType
  createdAt: string
  updatedAt: string
}

type SaveDatabaseConnectionResponse = {
  ok: boolean
  code:
    | 'success'
    | 'forbidden'
    | 'invalid_input'
    | 'duplicate_connection_name'
    | 'duplicate_connection_target'
    | 'persistence_unavailable'
    | 'unexpected_error'
  message: string
  messageKey?: string
  field?: keyof DatabaseConnection | 'body'
  issue?:
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
  connection?: SavedDatabaseConnectionSummary
}

const createUnexpectedResponse = (): SaveDatabaseConnectionResponse => ({
  ok: false,
  code: 'unexpected_error',
  message: 'connections.save.errors.unexpected',
  messageKey: 'connections.save.errors.unexpected'
})

const isSaveConnectionResponse = (
  value: unknown
): value is SaveDatabaseConnectionResponse => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'ok' in value &&
    'code' in value &&
    'message' in value
  )
}

export const useDatabaseConnectionSave = () => {
  const saveConnection = async (
    connection: DatabaseConnection
  ): Promise<SaveDatabaseConnectionResponse> => {
    try {
      return await $fetch<SaveDatabaseConnectionResponse>('/api/connections', {
        method: 'POST',
        body: connection
      })
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'data' in error &&
        isSaveConnectionResponse(error.data)
      ) {
        return error.data
      }

      return createUnexpectedResponse()
    }
  }

  return {
    saveConnection
  }
}

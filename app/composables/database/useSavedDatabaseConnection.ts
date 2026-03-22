import type { DatabaseSslMode, DatabaseType } from '~/types/database'

interface SavedDatabaseConnectionDetails {
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

type GetSavedDatabaseConnectionResponse = {
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
  field?: 'connectionId'
  issue?: 'connection_id_invalid'
  connection?: SavedDatabaseConnectionDetails
}

const createUnexpectedResponse = (): GetSavedDatabaseConnectionResponse => ({
  ok: false,
  code: 'unexpected_error',
  message: 'connections.edit.errors.unexpected',
  messageKey: 'connections.edit.errors.unexpected'
})

const isGetConnectionResponse = (
  value: unknown
): value is GetSavedDatabaseConnectionResponse => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'ok' in value &&
    'code' in value &&
    'message' in value
  )
}

type RequestFetch = <T>(
  request: string,
  options?: Record<string, unknown>
) => Promise<T>

export const useSavedDatabaseConnection = (
  requestFetch: RequestFetch = $fetch
) => {
  const getConnection = async (
    connectionId: string
  ): Promise<GetSavedDatabaseConnectionResponse> => {
    try {
      return await requestFetch<GetSavedDatabaseConnectionResponse>(
        `/api/connections/${connectionId}`
      )
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'data' in error &&
        isGetConnectionResponse(error.data)
      ) {
        return error.data
      }

      return createUnexpectedResponse()
    }
  }

  return {
    getConnection
  }
}

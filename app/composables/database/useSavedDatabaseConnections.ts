interface SavedDatabaseConnectionSummary {
  id: string
  connectionName: string
  databaseType: string
  createdAt: string
  updatedAt: string
}

type ListSavedDatabaseConnectionsResponse = {
  ok: boolean
  code:
    | 'success'
    | 'forbidden'
    | 'persistence_unavailable'
    | 'unexpected_error'
  message: string
  messageKey?: string
  connections?: SavedDatabaseConnectionSummary[]
}

const createUnexpectedResponse = (): ListSavedDatabaseConnectionsResponse => ({
  ok: false,
  code: 'unexpected_error',
  message: 'connections.list.errors.unexpected',
  messageKey: 'connections.list.errors.unexpected'
})

const isListConnectionsResponse = (
  value: unknown
): value is ListSavedDatabaseConnectionsResponse => {
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

export const useSavedDatabaseConnections = (
  requestFetch: RequestFetch = $fetch
) => {
  const listConnections = async (): Promise<ListSavedDatabaseConnectionsResponse> => {
    try {
      return await requestFetch<ListSavedDatabaseConnectionsResponse>(
        '/api/connections'
      )
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'data' in error &&
        isListConnectionsResponse(error.data)
      ) {
        return error.data
      }

      return createUnexpectedResponse()
    }
  }

  return {
    listConnections
  }
}

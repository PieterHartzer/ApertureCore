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

const getRequestFetch = () => {
  return import.meta.server
    ? useRequestFetch()
    : $fetch
}

export const useSavedDatabaseConnections = () => {
  const listConnections = async (): Promise<ListSavedDatabaseConnectionsResponse> => {
    try {
      return await getRequestFetch()<ListSavedDatabaseConnectionsResponse>(
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

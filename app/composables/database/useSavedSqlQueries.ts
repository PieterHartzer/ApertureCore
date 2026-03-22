interface SavedSqlQuerySummary {
  id: string
  queryName: string
  connectionId: string
  connectionName: string
  createdAt: string
  updatedAt: string
}

type ListSavedSqlQueriesResponse = {
  ok: boolean
  code:
    | 'success'
    | 'forbidden'
    | 'persistence_unavailable'
    | 'unexpected_error'
  message: string
  messageKey?: string
  queries?: SavedSqlQuerySummary[]
}

const createUnexpectedResponse = (): ListSavedSqlQueriesResponse => ({
  ok: false,
  code: 'unexpected_error',
  message: 'queries.list.errors.unexpected',
  messageKey: 'queries.list.errors.unexpected'
})

const isListSavedSqlQueriesResponse = (
  value: unknown
): value is ListSavedSqlQueriesResponse => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'ok' in value &&
    'code' in value &&
    'message' in value
  )
}

type RequestFetch = typeof $fetch

export const useSavedSqlQueries = (
  requestFetch: RequestFetch = $fetch
) => {
  const listQueries = async (): Promise<ListSavedSqlQueriesResponse> => {
    try {
      return await requestFetch<ListSavedSqlQueriesResponse>(
        '/api/queries'
      )
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'data' in error &&
        isListSavedSqlQueriesResponse(error.data)
      ) {
        return error.data
      }

      return createUnexpectedResponse()
    }
  }

  return {
    listQueries
  }
}

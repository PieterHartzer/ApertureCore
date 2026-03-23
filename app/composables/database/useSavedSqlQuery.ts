import type { SavedSqlQueryGetResponse } from '~/types/saved-sql-queries'

const createUnexpectedResponse = (): SavedSqlQueryGetResponse => ({
  ok: false,
  code: 'unexpected_error',
  message: 'queries.edit.errors.unexpected',
  messageKey: 'queries.edit.errors.unexpected'
})

const isGetSavedSqlQueryResponse = (
  value: unknown
): value is SavedSqlQueryGetResponse => {
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

export const useSavedSqlQuery = (
  requestFetch: RequestFetch = $fetch
) => {
  const getQuery = async (
    queryId: string
  ): Promise<SavedSqlQueryGetResponse> => {
    try {
      return await requestFetch<SavedSqlQueryGetResponse>(
        `/api/queries/${queryId}`
      )
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'data' in error &&
        isGetSavedSqlQueryResponse(error.data)
      ) {
        return error.data
      }

      return createUnexpectedResponse()
    }
  }

  return {
    getQuery
  }
}

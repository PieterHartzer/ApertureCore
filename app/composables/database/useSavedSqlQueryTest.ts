import type {
  SavedSqlQueryInput,
  SavedSqlQueryTestResponse
} from '~/types/saved-sql-queries'

const createUnexpectedResponse = (): SavedSqlQueryTestResponse => ({
  ok: false,
  code: 'unexpected_error',
  message: 'queries.test.errors.unexpected',
  messageKey: 'queries.test.errors.unexpected'
})

const isSavedSqlQueryTestResponse = (
  value: unknown
): value is SavedSqlQueryTestResponse => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'ok' in value &&
    'code' in value &&
    'message' in value
  )
}

export const useSavedSqlQueryTest = () => {
  const testQuery = async (
    query: Pick<SavedSqlQueryInput, 'connectionId' | 'sql'>
  ): Promise<SavedSqlQueryTestResponse> => {
    try {
      return await $fetch<SavedSqlQueryTestResponse>('/api/queries/test', {
        method: 'POST',
        body: query
      })
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'data' in error &&
        isSavedSqlQueryTestResponse(error.data)
      ) {
        return error.data
      }

      return createUnexpectedResponse()
    }
  }

  return {
    testQuery
  }
}

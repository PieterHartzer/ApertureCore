import type {
  SavedSqlQueryInput,
  SavedSqlQueryUpdateResponse
} from '~/types/saved-sql-queries'

const createUnexpectedResponse = (): SavedSqlQueryUpdateResponse => ({
  ok: false,
  code: 'unexpected_error',
  message: 'queries.update.errors.unexpected',
  messageKey: 'queries.update.errors.unexpected'
})

const isSavedSqlQueryUpdateResponse = (
  value: unknown
): value is SavedSqlQueryUpdateResponse => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'ok' in value &&
    'code' in value &&
    'message' in value
  )
}

export const useSavedSqlQueryUpdate = () => {
  const updateQuery = async (
    queryId: string,
    query: SavedSqlQueryInput
  ): Promise<SavedSqlQueryUpdateResponse> => {
    try {
      return await $fetch<SavedSqlQueryUpdateResponse>(
        `/api/queries/${queryId}`,
        {
          method: 'PUT',
          body: query
        }
      )
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'data' in error &&
        isSavedSqlQueryUpdateResponse(error.data)
      ) {
        return error.data
      }

      return createUnexpectedResponse()
    }
  }

  return {
    updateQuery
  }
}

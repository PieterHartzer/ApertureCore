import type {
  SavedSqlQueryDeleteRequest,
  SavedSqlQueryDeleteResponse
} from '~/types/saved-sql-queries'

const createUnexpectedResponse = (): SavedSqlQueryDeleteResponse => ({
  ok: false,
  code: 'unexpected_error',
  message: 'queries.delete.errors.unexpected',
  messageKey: 'queries.delete.errors.unexpected'
})

const isSavedSqlQueryDeleteResponse = (
  value: unknown
): value is SavedSqlQueryDeleteResponse => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'ok' in value &&
    'code' in value &&
    'message' in value
  )
}

export const useSavedSqlQueryDelete = () => {
  const deleteQuery = async (
    queryId: string,
    payload: SavedSqlQueryDeleteRequest
  ): Promise<SavedSqlQueryDeleteResponse> => {
    try {
      return await $fetch<SavedSqlQueryDeleteResponse>(
        `/api/queries/${queryId}`,
        {
          method: 'DELETE',
          body: payload
        }
      )
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'data' in error &&
        isSavedSqlQueryDeleteResponse(error.data)
      ) {
        return error.data
      }

      return createUnexpectedResponse()
    }
  }

  return {
    deleteQuery
  }
}

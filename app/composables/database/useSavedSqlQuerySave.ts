import type {
  SavedSqlQueryInput,
  SavedSqlQuerySaveResponse
} from '~/types/saved-sql-queries'

const createUnexpectedResponse = (): SavedSqlQuerySaveResponse => ({
  ok: false,
  code: 'unexpected_error',
  message: 'queries.save.errors.unexpected',
  messageKey: 'queries.save.errors.unexpected'
})

const isSaveSavedSqlQueryResponse = (
  value: unknown
): value is SavedSqlQuerySaveResponse => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'ok' in value &&
    'code' in value &&
    'message' in value
  )
}

export const useSavedSqlQuerySave = () => {
  const saveQuery = async (
    query: SavedSqlQueryInput
  ): Promise<SavedSqlQuerySaveResponse> => {
    try {
      return await $fetch<SavedSqlQuerySaveResponse>('/api/queries', {
        method: 'POST',
        body: query
      })
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'data' in error &&
        isSaveSavedSqlQueryResponse(error.data)
      ) {
        return error.data
      }

      return createUnexpectedResponse()
    }
  }

  return {
    saveQuery
  }
}

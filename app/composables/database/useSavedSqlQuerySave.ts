import type { SavedSqlQueryInput } from '~/types/saved-sql-queries'

interface SavedSqlQuerySummary {
  id: string
  queryName: string
  connectionId: string
  connectionName: string
  createdAt: string
  updatedAt: string
}

type SaveSavedSqlQueryResponse = {
  ok: boolean
  code:
    | 'success'
    | 'forbidden'
    | 'invalid_input'
    | 'not_found'
    | 'duplicate_query_name'
    | 'persistence_unavailable'
    | 'unexpected_error'
  message: string
  messageKey?: string
  field?: keyof SavedSqlQueryInput | 'body'
  issue?:
    | 'body_invalid'
    | 'query_name_invalid'
    | 'query_name_required'
    | 'connection_id_invalid'
    | 'sql_invalid'
    | 'sql_required'
  query?: SavedSqlQuerySummary
}

const createUnexpectedResponse = (): SaveSavedSqlQueryResponse => ({
  ok: false,
  code: 'unexpected_error',
  message: 'queries.save.errors.unexpected',
  messageKey: 'queries.save.errors.unexpected'
})

const isSaveSavedSqlQueryResponse = (
  value: unknown
): value is SaveSavedSqlQueryResponse => {
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
  ): Promise<SaveSavedSqlQueryResponse> => {
    try {
      return await $fetch<SaveSavedSqlQueryResponse>('/api/queries', {
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

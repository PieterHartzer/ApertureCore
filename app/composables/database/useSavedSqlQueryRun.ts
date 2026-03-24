import type { FetchOptions } from 'ofetch'

import type {
  SavedSqlQueryRunErrorResponse,
  SavedSqlQueryRunInput,
  SavedSqlQueryRunResponse,
  SavedSqlQueryRunSuccessResponse
} from '~/types/saved-sql-queries'

type RequestFetch = typeof $fetch

interface RawFetchResponse<TData> {
  status: number
  _data?: TData
  headers: Headers
}

const getRawFetch = (requestFetch: RequestFetch) => {
  const rawFetch = (requestFetch as RequestFetch & {
    raw?: (
      request: string,
      options?: FetchOptions<'json'>
    ) => Promise<RawFetchResponse<unknown>>
  }).raw

  return rawFetch ?? $fetch.raw
}

const buildUnexpectedErrorResponse = (): SavedSqlQueryRunErrorResponse => ({
  ok: false,
  code: 'unexpected_error',
  message: 'queries.run.errors.unexpected',
  messageKey: 'queries.run.errors.unexpected'
})

export const useSavedSqlQueryRun = (
  requestFetch: RequestFetch = $fetch
) => {
  const rawFetch = getRawFetch(requestFetch)

  const runQuery = async (
    input: SavedSqlQueryRunInput,
    options: {
      etag?: string
    } = {}
  ): Promise<SavedSqlQueryRunResponse> => {
    try {
      const response = await rawFetch('/api/query/run', {
        method: 'POST',
        body: input,
        headers: options.etag
          ? {
              'if-none-match': options.etag
            }
          : undefined,
        ignoreResponseError: true
      })

      if (response.status === 304) {
        return {
          ok: true,
          code: 'not_modified',
          etag: response.headers.get('etag') ?? options.etag ?? ''
        }
      }

      if (response.status >= 200 && response.status < 300) {
        const data = response._data as SavedSqlQueryRunSuccessResponse | undefined

        return {
          ok: true,
          code: 'success',
          columns: data?.columns ?? [],
          rows: data?.rows ?? [],
          etag: response.headers.get('etag') ?? data?.etag ?? ''
        }
      }

      const errorResponse = response._data as SavedSqlQueryRunErrorResponse | undefined

      if (errorResponse?.ok === false) {
        return errorResponse
      }

      return buildUnexpectedErrorResponse()
    } catch {
      return buildUnexpectedErrorResponse()
    }
  }

  return {
    runQuery
  }
}

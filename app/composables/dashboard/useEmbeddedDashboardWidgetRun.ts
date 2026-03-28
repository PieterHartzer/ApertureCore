import type { FetchOptions } from 'ofetch'

import type {
  EmbeddedDashboardWidgetRunErrorResponse,
  EmbeddedDashboardWidgetRunResponse,
  EmbeddedDashboardWidgetRunSuccessResponse
} from '~/types/dashboards'

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

const buildUnexpectedErrorResponse = (): EmbeddedDashboardWidgetRunErrorResponse => ({
  ok: false,
  code: 'unexpected_error',
  message: 'dashboards.embed.run.errors.unexpected',
  messageKey: 'dashboards.embed.run.errors.unexpected'
})

export const useEmbeddedDashboardWidgetRun = (
  requestFetch: RequestFetch = $fetch
) => {
  const rawFetch = getRawFetch(requestFetch)

  const runWidget = async (
    embedId: string,
    widgetId: string,
    options: {
      etag?: string
    } = {}
  ): Promise<EmbeddedDashboardWidgetRunResponse> => {
    try {
      const response = await rawFetch(
        `/api/embed/dashboards/${embedId}/widgets/${widgetId}/run`,
        {
          method: 'POST',
          headers: options.etag
            ? {
                'if-none-match': options.etag
              }
            : undefined,
          ignoreResponseError: true
        }
      )

      if (response.status === 304) {
        return {
          ok: true,
          code: 'not_modified',
          etag: response.headers.get('etag') ?? options.etag ?? ''
        }
      }

      if (response.status >= 200 && response.status < 300) {
        const data = response._data as EmbeddedDashboardWidgetRunSuccessResponse | undefined

        return {
          ok: true,
          code: 'success',
          columns: data?.columns ?? [],
          rows: data?.rows ?? [],
          etag: response.headers.get('etag') ?? data?.etag ?? ''
        }
      }

      const errorResponse = response._data as EmbeddedDashboardWidgetRunErrorResponse | undefined

      if (errorResponse?.ok === false) {
        return errorResponse
      }

      return buildUnexpectedErrorResponse()
    } catch {
      return buildUnexpectedErrorResponse()
    }
  }

  return {
    runWidget
  }
}

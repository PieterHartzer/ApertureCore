import type { EmbeddedDashboardGetResponse } from '~/types/dashboards'

type RequestFetch = <T>(
  request: string,
  options?: Record<string, unknown>
) => Promise<T>

const createUnexpectedResponse = (): EmbeddedDashboardGetResponse => ({
  ok: false,
  code: 'unexpected_error',
  message: 'dashboards.embed.get.errors.unexpected',
  messageKey: 'dashboards.embed.get.errors.unexpected'
})

const isEmbeddedDashboardResponse = (
  value: unknown
): value is EmbeddedDashboardGetResponse => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'ok' in value &&
    'code' in value &&
    'message' in value
  )
}

export const useEmbeddedDashboard = (
  requestFetch: RequestFetch = $fetch
) => {
  const getDashboard = async (
    embedId: string
  ): Promise<EmbeddedDashboardGetResponse> => {
    try {
      return await requestFetch<EmbeddedDashboardGetResponse>(
        `/api/embed/dashboards/${embedId}`
      )
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'data' in error &&
        isEmbeddedDashboardResponse(error.data)
      ) {
        return error.data
      }

      return createUnexpectedResponse()
    }
  }

  return {
    getDashboard
  }
}

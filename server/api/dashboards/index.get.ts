import type { ListDashboardsApiResponse } from '../../types/dashboards'

import { listDashboards } from '../../services/dashboards'
import { getAuthenticatedOrganizationContext } from '../../utils/auth-organization'

const ERROR_MESSAGE_KEYS: Record<
  Exclude<ListDashboardsApiResponse['code'], 'success'>,
  string
> = {
  forbidden: 'dashboards.list.errors.forbidden',
  persistence_unavailable: 'dashboards.list.errors.persistenceUnavailable',
  unexpected_error: 'dashboards.list.errors.unexpected'
}

const buildErrorResponse = (
  code: Exclude<ListDashboardsApiResponse['code'], 'success'>
): ListDashboardsApiResponse => {
  const messageKey = ERROR_MESSAGE_KEYS[code]

  return {
    ok: false,
    code,
    message: messageKey,
    messageKey
  }
}

export default defineEventHandler(async (event) => {
  try {
    const authContext = getAuthenticatedOrganizationContext(event)
    const result = await listDashboards(authContext)

    if (result.ok) {
      setResponseStatus(event, 200)

      return {
        ok: true,
        code: 'success',
        message: 'dashboards.list.success',
        messageKey: 'dashboards.list.success',
        dashboards: result.dashboards
      }
    }

    setResponseStatus(
      event,
      result.code === 'persistence_unavailable'
        ? 503
        : 500
    )

    return buildErrorResponse(result.code)
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'statusCode' in error &&
      error.statusCode === 403
    ) {
      setResponseStatus(event, 403)

      return buildErrorResponse('forbidden')
    }

    console.error(error)
    setResponseStatus(event, 500)

    return buildErrorResponse('unexpected_error')
  }
})

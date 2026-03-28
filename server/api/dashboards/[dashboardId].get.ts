import type { GetDashboardApiResponse } from '../../types/dashboards'

import { getDashboard } from '../../services/dashboards'
import { getAuthenticatedOrganizationContext } from '../../utils/auth-organization'
import { validateDashboardId } from '../../validators/dashboards'

const VALIDATION_MESSAGE_KEYS = {
  dashboard_id_invalid: 'dashboards.get.errors.dashboardIdInvalid'
} as const

const ERROR_MESSAGE_KEYS: Record<
  Exclude<GetDashboardApiResponse['code'], 'success' | 'invalid_input'>,
  string
> = {
  forbidden: 'dashboards.get.errors.forbidden',
  not_found: 'dashboards.get.errors.notFound',
  persistence_unavailable: 'dashboards.get.errors.persistenceUnavailable',
  unexpected_error: 'dashboards.get.errors.unexpected'
}

const buildValidationErrorResponse = (): GetDashboardApiResponse => {
  const messageKey = VALIDATION_MESSAGE_KEYS.dashboard_id_invalid

  return {
    ok: false,
    code: 'invalid_input',
    issue: 'dashboard_id_invalid',
    field: 'dashboardId',
    message: messageKey,
    messageKey
  }
}

const buildErrorResponse = (
  code: Exclude<GetDashboardApiResponse['code'], 'success' | 'invalid_input'>
): GetDashboardApiResponse => {
  const messageKey = ERROR_MESSAGE_KEYS[code]

  return {
    ok: false,
    code,
    message: messageKey,
    messageKey
  }
}

export default defineEventHandler(async (event) => {
  const validationResult = validateDashboardId(event.context.params?.dashboardId)

  if (!validationResult.ok) {
    setResponseStatus(event, 400)

    return buildValidationErrorResponse()
  }

  try {
    const authContext = getAuthenticatedOrganizationContext(event)
    const result = await getDashboard(authContext, validationResult.data.dashboardId)

    if (result.ok) {
      setResponseStatus(event, 200)

      return {
        ok: true,
        code: 'success',
        message: 'dashboards.get.success',
        messageKey: 'dashboards.get.success',
        dashboard: result.dashboard
      }
    }

    setResponseStatus(
      event,
      result.code === 'not_found'
        ? 404
        : result.code === 'persistence_unavailable'
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

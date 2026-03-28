import type {
  SaveDashboardApiResponse,
  SaveDashboardValidationError,
  SaveDashboardValidationIssue
} from '../../types/dashboards'

import { saveDashboard } from '../../services/dashboards'
import { getAuthenticatedOrganizationContext } from '../../utils/auth-organization'
import { validateSaveDashboardInput } from '../../validators/dashboards'

const VALIDATION_MESSAGE_KEYS: Record<
  SaveDashboardValidationIssue,
  string
> = {
  body_invalid: 'dashboards.save.errors.bodyInvalid',
  dashboard_id_invalid: 'dashboards.save.errors.dashboardIdInvalid',
  dashboard_name_invalid: 'dashboards.save.errors.dashboardNameInvalid',
  dashboard_name_required: 'dashboards.save.errors.dashboardNameRequired',
  embed_enabled_invalid: 'dashboards.save.errors.embedEnabledInvalid',
  widgets_invalid: 'dashboards.save.errors.widgetsInvalid',
  widget_id_invalid: 'dashboards.save.errors.widgetInvalid',
  widget_title_invalid: 'dashboards.save.errors.widgetInvalid',
  widget_title_required: 'dashboards.save.errors.widgetInvalid',
  widget_query_id_invalid: 'dashboards.save.errors.widgetInvalid',
  widget_plugin_id_invalid: 'dashboards.save.errors.widgetInvalid',
  widget_plugin_id_required: 'dashboards.save.errors.widgetInvalid',
  widget_plugin_config_invalid: 'dashboards.save.errors.widgetInvalid',
  widget_layout_invalid: 'dashboards.save.errors.widgetInvalid',
  widget_refresh_interval_invalid: 'dashboards.save.errors.widgetInvalid'
}

const ERROR_MESSAGE_KEYS: Record<
  Exclude<SaveDashboardApiResponse['code'], 'success' | 'invalid_input'>,
  string
> = {
  forbidden: 'dashboards.save.errors.forbidden',
  not_found: 'dashboards.save.errors.notFound',
  duplicate_dashboard_name: 'dashboards.save.errors.duplicateDashboardName',
  persistence_unavailable: 'dashboards.save.errors.persistenceUnavailable',
  unexpected_error: 'dashboards.save.errors.unexpected'
}

const buildValidationErrorResponse = (
  error: SaveDashboardValidationError
): SaveDashboardApiResponse => {
  const messageKey = VALIDATION_MESSAGE_KEYS[error.issue]

  return {
    ok: false,
    code: error.code,
    issue: error.issue,
    field: error.field,
    message: messageKey,
    messageKey
  }
}

const buildErrorResponse = (
  code: Exclude<SaveDashboardApiResponse['code'], 'success' | 'invalid_input'>
): SaveDashboardApiResponse => {
  const messageKey = ERROR_MESSAGE_KEYS[code]

  return {
    ok: false,
    code,
    message: messageKey,
    messageKey
  }
}

export default defineEventHandler(async (event) => {
  let body: unknown

  try {
    body = await readBody(event)
  } catch {
    setResponseStatus(event, 400)

    return buildValidationErrorResponse({
      ok: false,
      code: 'invalid_input',
      issue: 'body_invalid',
      field: 'body',
      message: 'body_invalid'
    })
  }

  const validationResult = validateSaveDashboardInput(
    event.context.params?.dashboardId,
    body
  )

  if (!validationResult.ok) {
    setResponseStatus(event, 400)

    return buildValidationErrorResponse(validationResult)
  }

  try {
    const authContext = getAuthenticatedOrganizationContext(event)
    const result = await saveDashboard(authContext, validationResult.data)

    if (result.ok) {
      setResponseStatus(event, 200)

      return {
        ok: true,
        code: 'success',
        message: 'dashboards.save.success',
        messageKey: 'dashboards.save.success',
        dashboard: result.dashboard
      }
    }

    setResponseStatus(
      event,
      result.code === 'not_found'
        ? 404
        : result.code === 'duplicate_dashboard_name'
          ? 409
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

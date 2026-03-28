import type {
  CreateDashboardApiResponse,
  CreateDashboardValidationError,
  CreateDashboardValidationIssue
} from '../../types/dashboards'

import { createDashboard } from '../../services/dashboards'
import { getAuthenticatedOrganizationContext } from '../../utils/auth-organization'
import { validateCreateDashboardInput } from '../../validators/dashboards'

const VALIDATION_MESSAGE_KEYS: Record<
  CreateDashboardValidationIssue,
  string
> = {
  body_invalid: 'dashboards.create.errors.bodyInvalid',
  dashboard_name_invalid: 'dashboards.create.errors.dashboardNameInvalid',
  dashboard_name_required: 'dashboards.create.errors.dashboardNameRequired'
}

const ERROR_MESSAGE_KEYS: Record<
  Exclude<CreateDashboardApiResponse['code'], 'success' | 'invalid_input'>,
  string
> = {
  forbidden: 'dashboards.create.errors.forbidden',
  duplicate_dashboard_name: 'dashboards.create.errors.duplicateDashboardName',
  persistence_unavailable: 'dashboards.create.errors.persistenceUnavailable',
  unexpected_error: 'dashboards.create.errors.unexpected'
}

const buildValidationErrorResponse = (
  error: CreateDashboardValidationError
): CreateDashboardApiResponse => {
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
  code: Exclude<CreateDashboardApiResponse['code'], 'success' | 'invalid_input'>
): CreateDashboardApiResponse => {
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

  const validationResult = validateCreateDashboardInput(body)

  if (!validationResult.ok) {
    setResponseStatus(event, 400)

    return buildValidationErrorResponse(validationResult)
  }

  try {
    const authContext = getAuthenticatedOrganizationContext(event)
    const result = await createDashboard(authContext, validationResult.data)

    if (result.ok) {
      setResponseStatus(event, 201)

      return {
        ok: true,
        code: 'success',
        message: 'dashboards.create.success',
        messageKey: 'dashboards.create.success',
        dashboard: result.dashboard
      }
    }

    setResponseStatus(
      event,
      result.code === 'duplicate_dashboard_name'
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

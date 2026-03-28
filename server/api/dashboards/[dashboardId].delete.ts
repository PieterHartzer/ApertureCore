import type {
  DeleteDashboardApiResponse,
  DeleteDashboardValidationError,
  DeleteDashboardValidationIssue
} from '../../types/dashboards'

import { deleteDashboard } from '../../services/dashboards'
import { getAuthenticatedOrganizationContext } from '../../utils/auth-organization'
import { validateDeleteDashboardInput } from '../../validators/dashboards'

const VALIDATION_MESSAGE_KEYS: Record<
  DeleteDashboardValidationIssue,
  string
> = {
  body_invalid: 'dashboards.delete.errors.bodyInvalid',
  dashboard_id_invalid: 'dashboards.delete.errors.dashboardIdInvalid',
  confirmation_name_invalid: 'dashboards.delete.errors.confirmationNameInvalid',
  confirmation_name_required: 'dashboards.delete.errors.confirmationNameRequired'
}

const ERROR_MESSAGE_KEYS: Record<
  Exclude<DeleteDashboardApiResponse['code'], 'success' | 'invalid_input'>,
  string
> = {
  forbidden: 'dashboards.delete.errors.forbidden',
  confirmation_mismatch: 'dashboards.delete.errors.confirmationMismatch',
  not_found: 'dashboards.delete.errors.notFound',
  persistence_unavailable: 'dashboards.delete.errors.persistenceUnavailable',
  unexpected_error: 'dashboards.delete.errors.unexpected'
}

const buildValidationErrorResponse = (
  error: DeleteDashboardValidationError
): DeleteDashboardApiResponse => {
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
  code: Exclude<DeleteDashboardApiResponse['code'], 'success' | 'invalid_input'>
): DeleteDashboardApiResponse => {
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

  const validationResult = validateDeleteDashboardInput(
    event.context.params?.dashboardId,
    body
  )

  if (!validationResult.ok) {
    setResponseStatus(event, 400)

    return buildValidationErrorResponse(validationResult)
  }

  try {
    const authContext = getAuthenticatedOrganizationContext(event)
    const result = await deleteDashboard(authContext, validationResult.data)

    if (result.ok) {
      setResponseStatus(event, 200)

      return {
        ok: true,
        code: 'success',
        message: 'dashboards.delete.success',
        messageKey: 'dashboards.delete.success'
      }
    }

    setResponseStatus(
      event,
      result.code === 'confirmation_mismatch'
        ? 409
        : result.code === 'not_found'
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

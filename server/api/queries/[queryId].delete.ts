import type {
  DeleteSavedSqlQueryApiResponse,
  DeleteSavedSqlQueryValidationError,
  DeleteSavedSqlQueryValidationIssue
} from '../../types/saved-sql-queries'

import { deleteSavedSqlQuery } from '../../services/saved-sql-queries'
import { getAuthenticatedOrganizationContext } from '../../utils/auth-organization'
import { validateDeleteSavedSqlQueryInput } from '../../validators/saved-sql-queries'

const VALIDATION_MESSAGE_KEYS: Record<
  DeleteSavedSqlQueryValidationIssue,
  string
> = {
  body_invalid: 'queries.delete.errors.bodyInvalid',
  query_id_invalid: 'queries.delete.errors.queryIdInvalid',
  confirmation_name_invalid: 'queries.delete.errors.confirmationNameInvalid',
  confirmation_name_required: 'queries.delete.errors.confirmationNameRequired'
}

const ERROR_MESSAGE_KEYS: Record<
  Exclude<DeleteSavedSqlQueryApiResponse['code'], 'success' | 'invalid_input'>,
  string
> = {
  forbidden: 'queries.delete.errors.forbidden',
  confirmation_mismatch: 'queries.delete.errors.confirmationMismatch',
  not_found: 'queries.delete.errors.notFound',
  persistence_unavailable: 'queries.delete.errors.persistenceUnavailable',
  unexpected_error: 'queries.delete.errors.unexpected'
}

const buildValidationErrorResponse = (
  error: DeleteSavedSqlQueryValidationError
): DeleteSavedSqlQueryApiResponse => {
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
  code: Exclude<DeleteSavedSqlQueryApiResponse['code'], 'success' | 'invalid_input'>
): DeleteSavedSqlQueryApiResponse => {
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

  const queryId = getRouterParam(event, 'queryId')
  const validationResult = validateDeleteSavedSqlQueryInput(queryId, body)

  if (!validationResult.ok) {
    setResponseStatus(event, 400)

    return buildValidationErrorResponse(validationResult)
  }

  try {
    const authContext = getAuthenticatedOrganizationContext(event)
    const result = await deleteSavedSqlQuery(authContext, validationResult.data)

    if (result.ok) {
      setResponseStatus(event, 200)

      return {
        ok: true,
        code: 'success',
        message: 'queries.delete.success',
        messageKey: 'queries.delete.success'
      }
    }

    if (result.code === 'confirmation_mismatch') {
      setResponseStatus(event, 409)
    } else if (result.code === 'not_found') {
      setResponseStatus(event, 404)
    } else if (result.code === 'persistence_unavailable') {
      setResponseStatus(event, 503)
    } else {
      setResponseStatus(event, 500)
    }

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

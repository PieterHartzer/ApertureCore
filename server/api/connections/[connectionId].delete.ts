import type {
  DeleteDatabaseConnectionApiResponse,
  DeleteDatabaseConnectionValidationError,
  DeleteDatabaseConnectionValidationIssue
} from '../../types/database-connections'

import { deleteDatabaseConnection } from '../../services/database-connections'
import { getAuthenticatedOrganizationContext } from '../../utils/auth-organization'
import { validateDeleteDatabaseConnectionInput } from '../../validators/database-connections'

const VALIDATION_MESSAGE_KEYS: Record<
  DeleteDatabaseConnectionValidationIssue,
  string
> = {
  body_invalid: 'connections.delete.errors.bodyInvalid',
  connection_id_invalid: 'connections.delete.errors.connectionIdInvalid',
  confirmation_name_invalid: 'connections.delete.errors.confirmationNameInvalid',
  confirmation_name_required: 'connections.delete.errors.confirmationNameRequired',
  delete_linked_queries_invalid: 'connections.delete.errors.deleteLinkedQueriesInvalid'
}

const ERROR_MESSAGE_KEYS: Record<
  Exclude<DeleteDatabaseConnectionApiResponse['code'], 'success' | 'invalid_input'>,
  string
> = {
  forbidden: 'connections.delete.errors.forbidden',
  confirmation_mismatch: 'connections.delete.errors.confirmationMismatch',
  not_found: 'connections.delete.errors.notFound',
  persistence_unavailable: 'connections.delete.errors.persistenceUnavailable',
  unexpected_error: 'connections.delete.errors.unexpected'
}

const buildValidationErrorResponse = (
  error: DeleteDatabaseConnectionValidationError
): DeleteDatabaseConnectionApiResponse => {
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
  code: Exclude<DeleteDatabaseConnectionApiResponse['code'], 'success' | 'invalid_input'>
): DeleteDatabaseConnectionApiResponse => {
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

  const connectionId = getRouterParam(event, 'connectionId')
  const validationResult = validateDeleteDatabaseConnectionInput(connectionId, body)

  if (!validationResult.ok) {
    setResponseStatus(event, 400)

    return buildValidationErrorResponse(validationResult)
  }

  try {
    const authContext = getAuthenticatedOrganizationContext(event)
    const result = await deleteDatabaseConnection(authContext, validationResult.data)

    if (result.ok) {
      setResponseStatus(event, 200)

      return {
        ok: true,
        code: 'success',
        message: 'connections.delete.success',
        messageKey: 'connections.delete.success'
      }
    }

    switch (result.code) {
      case 'confirmation_mismatch':
        setResponseStatus(event, 409)
        break
      case 'not_found':
        setResponseStatus(event, 404)
        break
      case 'persistence_unavailable':
        setResponseStatus(event, 503)
        break
      default:
        setResponseStatus(event, 500)
        break
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

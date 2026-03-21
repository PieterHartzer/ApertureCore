import type {
  GetSavedDatabaseConnectionApiResponse,
  SavedDatabaseConnectionIdValidationError
} from '../../types/database-connections'

import { getSavedDatabaseConnection } from '../../services/database-connections'
import { getAuthenticatedOrganizationContext } from '../../utils/auth-organization'
import { validateSavedDatabaseConnectionId } from '../../validators/database-connections'

const VALIDATION_MESSAGE_KEYS: Record<'connection_id_invalid', string> = {
  connection_id_invalid: 'connections.edit.errors.connectionIdInvalid'
}

const ERROR_MESSAGE_KEYS: Record<
  Exclude<GetSavedDatabaseConnectionApiResponse['code'], 'success' | 'invalid_input'>,
  string
> = {
  forbidden: 'connections.edit.errors.forbidden',
  not_found: 'connections.edit.errors.notFound',
  persistence_unavailable: 'connections.edit.errors.persistenceUnavailable',
  unexpected_error: 'connections.edit.errors.unexpected'
}

const buildValidationErrorResponse = (
  error: SavedDatabaseConnectionIdValidationError
): GetSavedDatabaseConnectionApiResponse => {
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
  code: Exclude<GetSavedDatabaseConnectionApiResponse['code'], 'success' | 'invalid_input'>
): GetSavedDatabaseConnectionApiResponse => {
  const messageKey = ERROR_MESSAGE_KEYS[code]

  return {
    ok: false,
    code,
    message: messageKey,
    messageKey
  }
}

export default defineEventHandler(async (event) => {
  const connectionId = getRouterParam(event, 'connectionId')
  const connectionIdValidation = validateSavedDatabaseConnectionId(connectionId)

  if (!connectionIdValidation.ok) {
    setResponseStatus(event, 400)

    return buildValidationErrorResponse(connectionIdValidation)
  }

  try {
    const authContext = getAuthenticatedOrganizationContext(event)
    const result = await getSavedDatabaseConnection(
      authContext,
      connectionIdValidation.data.connectionId
    )

    if (result.ok) {
      setResponseStatus(event, 200)

      return {
        ok: true,
        code: 'success',
        message: 'connections.edit.success',
        messageKey: 'connections.edit.success',
        connection: result.connection
      }
    }

    switch (result.code) {
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

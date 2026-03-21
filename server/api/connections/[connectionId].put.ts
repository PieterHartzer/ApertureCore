import type {
  UpdateDatabaseConnectionApiResponse,
  UpdateDatabaseConnectionValidationError,
  UpdateDatabaseConnectionValidationIssue
} from '../../types/database-connections'

import { updateDatabaseConnection } from '../../services/database-connections'
import { getAuthenticatedOrganizationContext } from '../../utils/auth-organization'
import { validateUpdateDatabaseConnectionInput } from '../../validators/database-connections'

const VALIDATION_MESSAGE_KEYS: Record<
  UpdateDatabaseConnectionValidationIssue,
  string
> = {
  body_invalid: 'connections.update.errors.bodyInvalid',
  connection_id_invalid: 'connections.update.errors.connectionIdInvalid',
  connection_name_invalid: 'connections.update.errors.connectionNameInvalid',
  connection_name_required: 'connections.update.errors.connectionNameRequired',
  database_type_invalid: 'connections.update.errors.databaseTypeInvalid',
  host_required: 'connections.update.errors.hostRequired',
  port_invalid: 'connections.update.errors.portInvalid',
  database_name_required: 'connections.update.errors.databaseNameRequired',
  username_required: 'connections.update.errors.usernameRequired',
  password_required: 'connections.update.errors.passwordRequired',
  ssl_mode_invalid: 'connections.update.errors.sslModeInvalid'
}

const ERROR_MESSAGE_KEYS: Record<
  Exclude<UpdateDatabaseConnectionApiResponse['code'], 'success' | 'invalid_input'>,
  string
> = {
  forbidden: 'connections.update.errors.forbidden',
  not_found: 'connections.update.errors.notFound',
  duplicate_connection_name: 'connections.update.errors.duplicateConnectionName',
  duplicate_connection_target: 'connections.update.errors.duplicateConnectionTarget',
  persistence_unavailable: 'connections.update.errors.persistenceUnavailable',
  unexpected_error: 'connections.update.errors.unexpected'
}

const buildValidationErrorResponse = (
  error: UpdateDatabaseConnectionValidationError
): UpdateDatabaseConnectionApiResponse => {
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
  code: Exclude<UpdateDatabaseConnectionApiResponse['code'], 'success' | 'invalid_input'>
): UpdateDatabaseConnectionApiResponse => {
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
  const validationResult = validateUpdateDatabaseConnectionInput(connectionId, body)

  if (!validationResult.ok) {
    setResponseStatus(event, 400)

    return buildValidationErrorResponse(validationResult)
  }

  try {
    const authContext = getAuthenticatedOrganizationContext(event)
    const result = await updateDatabaseConnection(authContext, validationResult.data)

    if (result.ok) {
      setResponseStatus(event, 200)

      return {
        ok: true,
        code: 'success',
        message: 'connections.update.success',
        messageKey: 'connections.update.success',
        connection: result.connection
      }
    }

    switch (result.code) {
      case 'not_found':
        setResponseStatus(event, 404)
        break
      case 'duplicate_connection_name':
      case 'duplicate_connection_target':
        setResponseStatus(event, 409)
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

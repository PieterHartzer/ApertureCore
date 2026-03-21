import type {
  SaveDatabaseConnectionApiResponse,
  SaveDatabaseConnectionValidationError,
  SaveDatabaseConnectionValidationIssue
} from '../../types/database-connections'

import { saveDatabaseConnection } from '../../services/database-connections'
import { getAuthenticatedOrganizationContext } from '../../utils/auth-organization'
import { validateSaveDatabaseConnectionInput } from '../../validators/database-connections'

const VALIDATION_MESSAGE_KEYS: Record<
  SaveDatabaseConnectionValidationIssue,
  string
> = {
  body_invalid: 'connections.save.errors.bodyInvalid',
  connection_name_invalid: 'connections.save.errors.connectionNameInvalid',
  connection_name_required: 'connections.save.errors.connectionNameRequired',
  database_type_invalid: 'connections.save.errors.databaseTypeInvalid',
  host_required: 'connections.save.errors.hostRequired',
  port_invalid: 'connections.save.errors.portInvalid',
  database_name_required: 'connections.save.errors.databaseNameRequired',
  username_required: 'connections.save.errors.usernameRequired',
  password_required: 'connections.save.errors.passwordRequired',
  ssl_mode_invalid: 'connections.save.errors.sslModeInvalid'
}

const ERROR_MESSAGE_KEYS: Record<
  Exclude<SaveDatabaseConnectionApiResponse['code'], 'success' | 'invalid_input'>,
  string
> = {
  forbidden: 'connections.save.errors.forbidden',
  duplicate_connection_name: 'connections.save.errors.duplicateConnectionName',
  duplicate_connection_target: 'connections.save.errors.duplicateConnectionTarget',
  persistence_unavailable: 'connections.save.errors.persistenceUnavailable',
  unexpected_error: 'connections.save.errors.unexpected'
}

const buildValidationErrorResponse = (
  error: SaveDatabaseConnectionValidationError
): SaveDatabaseConnectionApiResponse => {
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
  code: Exclude<SaveDatabaseConnectionApiResponse['code'], 'success' | 'invalid_input'>
): SaveDatabaseConnectionApiResponse => {
  const messageKey = ERROR_MESSAGE_KEYS[code]

  return {
    ok: false,
    code,
    message: messageKey,
    messageKey
  }
}

const isSaveServiceError = (
  result: Awaited<ReturnType<typeof saveDatabaseConnection>>
): result is Extract<
  Awaited<ReturnType<typeof saveDatabaseConnection>>,
  { ok: false }
> => {
  return !result.ok
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

  const validationResult = validateSaveDatabaseConnectionInput(body)

  if (!validationResult.ok) {
    setResponseStatus(event, 400)

    return buildValidationErrorResponse(validationResult)
  }

  try {
    const authContext = getAuthenticatedOrganizationContext(event)
    const result = await saveDatabaseConnection(authContext, validationResult.data)

    if (!isSaveServiceError(result)) {
      setResponseStatus(event, 201)

      return {
        ok: true,
        code: 'success',
        message: 'connections.save.success',
        messageKey: 'connections.save.success',
        connection: result.connection
      }
    }

    switch (result.code) {
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

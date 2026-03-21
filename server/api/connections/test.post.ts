import type {
  TestDatabaseConnectionApiResponse,
  TestDatabaseConnectionResultCode,
  TestDatabaseConnectionValidationError,
  TestDatabaseConnectionValidationIssue,
} from '../../types/database'

import { testDatabaseConnection } from '../../services/database/index'
import { getSavedDatabaseConnectionSecret } from '../../services/database-connections'
import { getAuthenticatedOrganizationContext } from '../../utils/auth-organization'
import { consumeConnectionTestRateLimit } from '../../utils/database-connection-test-rate-limit'
import { validateSavedDatabaseConnectionId } from '../../validators/database-connections'
import { validateTestDatabaseConnectionInput } from '../../validators/database'

const VALIDATION_MESSAGE_KEYS: Record<
  TestDatabaseConnectionValidationIssue,
  string
> = {
  body_invalid: 'connections.test.errors.bodyInvalid',
  connection_id_invalid: 'connections.test.errors.connectionIdInvalid',
  connection_name_invalid: 'connections.test.errors.connectionNameInvalid',
  database_type_invalid: 'connections.test.errors.databaseTypeInvalid',
  host_required: 'connections.test.errors.hostRequired',
  port_invalid: 'connections.test.errors.portInvalid',
  database_name_required: 'connections.test.errors.databaseNameRequired',
  username_required: 'connections.test.errors.usernameRequired',
  password_required: 'connections.test.errors.passwordRequired', // NOSONAR: Not a harcoded password
  ssl_mode_invalid: 'connections.test.errors.sslModeInvalid'
}

const ERROR_MESSAGE_KEYS: Record<
  Exclude<TestDatabaseConnectionResultCode, 'success'>,
  string
> = {
  unauthorized: 'connections.test.errors.unauthorized',
  rate_limited: 'connections.test.errors.rateLimited',
  invalid_input: 'connections.test.errors.invalidInput',
  saved_connection_not_found: 'connections.test.errors.savedConnectionNotFound',
  unsupported_database_type: 'connections.test.errors.unsupportedDatabaseType',
  authentication_failed: 'connections.test.errors.authenticationFailed',
  database_not_found: 'connections.test.errors.databaseNotFound',
  connection_failed: 'connections.test.errors.connectionFailed',
  timeout: 'connections.test.errors.timeout',
  ssl_required: 'connections.test.errors.sslRequired',
  unexpected_error: 'connections.test.errors.unexpected'
}

type ServiceErrorResponse = TestDatabaseConnectionApiResponse & {
  code: Exclude<TestDatabaseConnectionResultCode, 'success'>
}

const buildValidationErrorResponse = (
  error: TestDatabaseConnectionValidationError
): TestDatabaseConnectionApiResponse => {
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

const buildServiceErrorResponse = (
  response: ServiceErrorResponse
): TestDatabaseConnectionApiResponse => {
  const messageKey = ERROR_MESSAGE_KEYS[response.code]

  return {
    ok: false,
    code: response.code,
    message: messageKey,
    messageKey
  }
}

const isServiceErrorResponse = (
  response: TestDatabaseConnectionApiResponse
): response is ServiceErrorResponse => {
  return response.code !== 'success'
}

const mapCodeToStatus = (code: Exclude<TestDatabaseConnectionResultCode, 'success'>): number => {
  switch (code) {
    case 'invalid_input':
    case 'unsupported_database_type':
    case 'ssl_required':
      return 400
    case 'rate_limited':
      return 429
    case 'authentication_failed':
      return 401
    case 'saved_connection_not_found':
      return 404
    case 'database_not_found':
      return 404
    case 'timeout':
      return 504
    case 'connection_failed':
      return 503
    case 'unauthorized':
      return 401
    case 'unexpected_error':
      return 500
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export default defineEventHandler(async (event) => {
  // Prevents it used as a fast port scanner
  const rateLimit = await consumeConnectionTestRateLimit(event)

  if (!rateLimit.allowed) {
    setResponseHeader(event, 'retry-after', rateLimit.retryAfterSeconds)
    setResponseStatus(event, 429)

    return buildServiceErrorResponse({
      ok: false,
      code: 'rate_limited',
      message: 'rate_limited'
    })
  }

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

  if (
    isRecord(body) &&
    'connectionId' in body &&
    (
      body.password === undefined ||
      (typeof body.password === 'string' && !body.password.trim())
    )
  ) {
    const connectionIdValidation = validateSavedDatabaseConnectionId(body.connectionId)

    if (!connectionIdValidation.ok) {
      setResponseStatus(event, 400)

      return buildValidationErrorResponse({
        ok: false,
        code: 'invalid_input',
        issue: 'connection_id_invalid',
        field: 'connectionId',
        message: 'connection_id_invalid'
      })
    }

    try {
      const authContext = getAuthenticatedOrganizationContext(event)
      const savedSecretResult = await getSavedDatabaseConnectionSecret(
        authContext,
        connectionIdValidation.data.connectionId
      )

      if (!savedSecretResult.ok) {
        setResponseStatus(event, mapCodeToStatus('saved_connection_not_found'))

        return buildServiceErrorResponse({
          ok: false,
          code: 'saved_connection_not_found',
          message: 'saved_connection_not_found'
        })
      }

      body = {
        ...body,
        password: savedSecretResult.secret.password
      }
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'statusCode' in error &&
        error.statusCode === 403
      ) {
        setResponseStatus(event, mapCodeToStatus('unauthorized'))

        return buildServiceErrorResponse({
          ok: false,
          code: 'unauthorized',
          message: 'unauthorized'
        })
      }

      console.error(error)
      setResponseStatus(event, 500)

      return buildServiceErrorResponse({
        ok: false,
        code: 'unexpected_error',
        message: 'unexpected_error'
      })
    }
  }

  const validationResult = validateTestDatabaseConnectionInput(body)

  if (!validationResult.ok) {
    setResponseStatus(event, 400)

    return buildValidationErrorResponse(validationResult)
  }

  try {
    const result = await testDatabaseConnection(validationResult.data)

    if (!isServiceErrorResponse(result)) {
      setResponseStatus(event, 200)
      return {
        ...result,
        message: 'connections.test.success',
        messageKey: 'connections.test.success'
      }
    }

    setResponseStatus(event, mapCodeToStatus(result.code))

    return buildServiceErrorResponse(result)
  } catch (error) {
    console.error(error)
    setResponseStatus(event, 500)

    return buildServiceErrorResponse({
      ok: false,
      code: 'unexpected_error',
      message: 'unexpected_error'
    })
  }
})

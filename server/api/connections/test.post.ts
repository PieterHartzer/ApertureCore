import type {
  TestDatabaseConnectionApiResponse,
  TestDatabaseConnectionResultCode,
  TestDatabaseConnectionValidationError,
  TestDatabaseConnectionValidationIssue,
} from '../../types/database'

import { testDatabaseConnection } from '../../services/database/index'
import { consumeConnectionTestRateLimit } from '../../utils/database-connection-test-rate-limit'
import { validateTestDatabaseConnectionInput } from '../../validators/database'

const VALIDATION_MESSAGE_KEYS: Record<
  TestDatabaseConnectionValidationIssue,
  string
> = {
  body_invalid: 'connections.test.errors.bodyInvalid',
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
  unsupported_database_type: 'connections.test.errors.unsupportedDatabaseType',
  authentication_failed: 'connections.test.errors.authenticationFailed',
  database_not_found: 'connections.test.errors.databaseNotFound',
  connection_failed: 'connections.test.errors.connectionFailed',
  timeout: 'connections.test.errors.timeout',
  ssl_required: 'connections.test.errors.sslRequired',
  not_implemented: 'connections.test.errors.notImplemented',
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

export default defineEventHandler(async (event) => {
  const rateLimit = await consumeConnectionTestRateLimit(event)

  if (!rateLimit.allowed) {
    setResponseHeader(event, 'retry-after', String(rateLimit.retryAfterSeconds))
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

    switch (result.code) {
      case 'invalid_input':
        setResponseStatus(event, 400)
        break
      case 'rate_limited':
        setResponseStatus(event, 429)
        break
      case 'unsupported_database_type':
        setResponseStatus(event, 400)
        break
      case 'authentication_failed':
        setResponseStatus(event, 401)
        break
      case 'database_not_found':
        setResponseStatus(event, 404)
        break
      case 'ssl_required':
        setResponseStatus(event, 400)
        break
      case 'timeout':
        setResponseStatus(event, 504)
        break
      case 'connection_failed':
        setResponseStatus(event, 503)
        break
      case 'not_implemented':
        setResponseStatus(event, 501)
        break
      default:
        setResponseStatus(event, 500)
        break
    }

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

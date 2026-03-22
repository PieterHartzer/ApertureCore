import type {
  TestSavedSqlQueryApiResponse,
  TestSavedSqlQueryValidationError,
  TestSavedSqlQueryValidationIssue
} from '../../types/saved-sql-queries'

import { testSavedSqlQuery } from '../../services/saved-sql-queries'
import { getAuthenticatedOrganizationContext } from '../../utils/auth-organization'
import { consumeSavedSqlQueryTestRateLimit } from '../../utils/saved-sql-query-test-rate-limit'
import { validateTestSavedSqlQueryInput } from '../../validators/saved-sql-queries'

const VALIDATION_MESSAGE_KEYS: Record<
  TestSavedSqlQueryValidationIssue,
  string
> = {
  body_invalid: 'queries.test.errors.bodyInvalid',
  connection_id_invalid: 'queries.test.errors.connectionIdInvalid',
  sql_invalid: 'queries.test.errors.sqlInvalid',
  sql_required: 'queries.test.errors.sqlRequired'
}

const ERROR_MESSAGE_KEYS: Record<
  Exclude<TestSavedSqlQueryApiResponse['code'], 'success' | 'invalid_input'>,
  string
> = {
  forbidden: 'queries.test.errors.forbidden',
  rate_limited: 'queries.test.errors.rateLimited',
  saved_connection_not_found: 'queries.test.errors.savedConnectionNotFound',
  unsupported_database_type: 'queries.test.errors.unsupportedDatabaseType',
  authentication_failed: 'queries.test.errors.authenticationFailed',
  database_not_found: 'queries.test.errors.databaseNotFound',
  connection_failed: 'queries.test.errors.connectionFailed',
  timeout: 'queries.test.errors.timeout',
  ssl_required: 'queries.test.errors.sslRequired',
  query_rejected: 'queries.test.errors.queryRejected',
  query_failed: 'queries.test.errors.queryFailed',
  persistence_unavailable: 'queries.test.errors.persistenceUnavailable',
  unexpected_error: 'queries.test.errors.unexpected'
}

type ErrorResponseCode = Exclude<
  TestSavedSqlQueryApiResponse['code'],
  'success' | 'invalid_input'
>

type ServiceErrorResponse = TestSavedSqlQueryApiResponse & {
  code: ErrorResponseCode
}

const buildValidationErrorResponse = (
  error: TestSavedSqlQueryValidationError
): TestSavedSqlQueryApiResponse => {
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
): TestSavedSqlQueryApiResponse => {
  const messageKey = ERROR_MESSAGE_KEYS[response.code]

  return {
    ok: false,
    code: response.code,
    message: messageKey,
    messageKey,
    details: response.details
  }
}

const mapCodeToStatus = (
  code: ErrorResponseCode
): number => {
  switch (code) {
    case 'forbidden':
      return 403
    case 'rate_limited':
      return 429
    case 'saved_connection_not_found':
      return 404
    case 'unsupported_database_type':
    case 'ssl_required':
    case 'query_rejected':
    case 'query_failed':
      return 400
    case 'authentication_failed':
      return 401
    case 'database_not_found':
      return 404
    case 'connection_failed':
    case 'persistence_unavailable':
      return 503
    case 'timeout':
      return 504
    case 'unexpected_error':
      return 500
  }
}

export default defineEventHandler(async (event) => {
  const rateLimit = await consumeSavedSqlQueryTestRateLimit(event)

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

  const validationResult = validateTestSavedSqlQueryInput(body)

  if (!validationResult.ok) {
    setResponseStatus(event, 400)

    return buildValidationErrorResponse(validationResult)
  }

  try {
    const authContext = getAuthenticatedOrganizationContext(event)
    const result = await testSavedSqlQuery(authContext, validationResult.data)

    if (result.ok) {
      setResponseStatus(event, 200)

      return {
        ok: true,
        code: 'success',
        message: 'queries.test.success',
        messageKey: 'queries.test.success',
        columns: result.columns,
        rows: result.rows,
        rowLimit: result.rowLimit
      }
    }

    setResponseStatus(event, mapCodeToStatus(result.code))

    return buildServiceErrorResponse({
      ok: false,
      code: result.code,
      message: result.message,
      details: result.details
    })
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'statusCode' in error &&
      error.statusCode === 403
    ) {
      setResponseStatus(event, 403)

      return buildServiceErrorResponse({
        ok: false,
        code: 'forbidden',
        message: 'forbidden'
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
})

import type {
  SaveSavedSqlQueryApiResponse,
  SaveSavedSqlQueryValidationError,
  SaveSavedSqlQueryValidationIssue
} from '../../types/saved-sql-queries'

import { saveSavedSqlQuery } from '../../services/saved-sql-queries'
import { getAuthenticatedOrganizationContext } from '../../utils/auth-organization'
import { validateSaveSavedSqlQueryInput } from '../../validators/saved-sql-queries'

const VALIDATION_MESSAGE_KEYS: Record<
  SaveSavedSqlQueryValidationIssue,
  string
> = {
  body_invalid: 'queries.save.errors.bodyInvalid',
  query_name_invalid: 'queries.save.errors.queryNameInvalid',
  query_name_required: 'queries.save.errors.queryNameRequired',
  connection_id_invalid: 'queries.save.errors.connectionIdInvalid',
  sql_invalid: 'queries.save.errors.sqlInvalid',
  sql_required: 'queries.save.errors.sqlRequired',
  sql_too_long: 'queries.save.errors.sqlTooLong',
  sql_invalid_characters: 'queries.save.errors.sqlInvalidCharacters',
  sql_multiple_statements: 'queries.save.errors.sqlMultipleStatements',
  sql_not_read_only: 'queries.save.errors.sqlNotReadOnly'
}

const ERROR_MESSAGE_KEYS: Record<
  Exclude<SaveSavedSqlQueryApiResponse['code'], 'success' | 'invalid_input'>,
  string
> = {
  forbidden: 'queries.save.errors.forbidden',
  not_found: 'queries.save.errors.notFound',
  duplicate_query_name: 'queries.save.errors.duplicateQueryName',
  persistence_unavailable: 'queries.save.errors.persistenceUnavailable',
  unexpected_error: 'queries.save.errors.unexpected'
}

const buildValidationErrorResponse = (
  error: SaveSavedSqlQueryValidationError
): SaveSavedSqlQueryApiResponse => {
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
  code: Exclude<SaveSavedSqlQueryApiResponse['code'], 'success' | 'invalid_input'>
): SaveSavedSqlQueryApiResponse => {
  const messageKey = ERROR_MESSAGE_KEYS[code]

  return {
    ok: false,
    code,
    message: messageKey,
    messageKey
  }
}

const isSaveServiceError = (
  result: Awaited<ReturnType<typeof saveSavedSqlQuery>>
): result is Extract<
  Awaited<ReturnType<typeof saveSavedSqlQuery>>,
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

  const validationResult = validateSaveSavedSqlQueryInput(body)

  if (!validationResult.ok) {
    setResponseStatus(event, 400)

    return buildValidationErrorResponse(validationResult)
  }

  try {
    const authContext = getAuthenticatedOrganizationContext(event)
    const result = await saveSavedSqlQuery(authContext, validationResult.data)

    if (!isSaveServiceError(result)) {
      setResponseStatus(event, 201)

      return {
        ok: true,
        code: 'success',
        message: 'queries.save.success',
        messageKey: 'queries.save.success',
        query: result.query
      }
    }

    switch (result.code) {
      case 'not_found':
        setResponseStatus(event, 404)
        break
      case 'duplicate_query_name':
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

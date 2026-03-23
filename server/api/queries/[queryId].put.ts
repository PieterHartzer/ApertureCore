import type {
  UpdateSavedSqlQueryApiResponse,
  UpdateSavedSqlQueryValidationError,
  UpdateSavedSqlQueryValidationIssue
} from '../../types/saved-sql-queries'

import { getAuthenticatedOrganizationContext } from '../../utils/auth-organization'
import { updateSavedSqlQuery } from '../../services/saved-sql-queries'
import { validateUpdateSavedSqlQueryInput } from '../../validators/saved-sql-queries'

const VALIDATION_MESSAGE_KEYS: Record<
  UpdateSavedSqlQueryValidationIssue,
  string
> = {
  body_invalid: 'queries.update.errors.bodyInvalid',
  query_id_invalid: 'queries.update.errors.queryIdInvalid',
  query_name_invalid: 'queries.update.errors.queryNameInvalid',
  query_name_required: 'queries.update.errors.queryNameRequired',
  connection_id_invalid: 'queries.update.errors.connectionIdInvalid',
  sql_invalid: 'queries.update.errors.sqlInvalid',
  sql_required: 'queries.update.errors.sqlRequired',
  sql_too_long: 'queries.update.errors.sqlTooLong',
  sql_invalid_characters: 'queries.update.errors.sqlInvalidCharacters',
  sql_multiple_statements: 'queries.update.errors.sqlMultipleStatements',
  sql_not_read_only: 'queries.update.errors.sqlNotReadOnly'
}

const ERROR_MESSAGE_KEYS: Record<
  Exclude<UpdateSavedSqlQueryApiResponse['code'], 'success' | 'invalid_input'>,
  string
> = {
  forbidden: 'queries.update.errors.forbidden',
  not_found: 'queries.update.errors.notFound',
  duplicate_query_name: 'queries.update.errors.duplicateQueryName',
  persistence_unavailable: 'queries.update.errors.persistenceUnavailable',
  unexpected_error: 'queries.update.errors.unexpected'
}

const buildValidationErrorResponse = (
  error: UpdateSavedSqlQueryValidationError
): UpdateSavedSqlQueryApiResponse => {
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
  code: Exclude<UpdateSavedSqlQueryApiResponse['code'], 'success' | 'invalid_input'>
): UpdateSavedSqlQueryApiResponse => {
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
  const validationResult = validateUpdateSavedSqlQueryInput(queryId, body)

  if (!validationResult.ok) {
    setResponseStatus(event, 400)

    return buildValidationErrorResponse(validationResult)
  }

  try {
    const authContext = getAuthenticatedOrganizationContext(event)
    const result = await updateSavedSqlQuery(authContext, validationResult.data)

    if (result.ok) {
      setResponseStatus(event, 200)

      return {
        ok: true,
        code: 'success',
        message: 'queries.update.success',
        messageKey: 'queries.update.success',
        query: result.query
      }
    }

    if (result.code === 'not_found') {
      setResponseStatus(event, 404)
    } else if (result.code === 'duplicate_query_name') {
      setResponseStatus(event, 409)
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

import type {
  GetSavedSqlQueryApiResponse,
  SavedSqlQueryIdValidationError
} from '../../types/saved-sql-queries'

import { getSavedSqlQuery } from '../../services/saved-sql-queries'
import { getAuthenticatedOrganizationContext } from '../../utils/auth-organization'
import { validateSavedSqlQueryId } from '../../validators/saved-sql-queries'

const VALIDATION_MESSAGE_KEYS: Record<'query_id_invalid', string> = {
  query_id_invalid: 'queries.edit.errors.queryIdInvalid'
}

const ERROR_MESSAGE_KEYS: Record<
  Exclude<GetSavedSqlQueryApiResponse['code'], 'success' | 'invalid_input'>,
  string
> = {
  forbidden: 'queries.edit.errors.forbidden',
  not_found: 'queries.edit.errors.notFound',
  persistence_unavailable: 'queries.edit.errors.persistenceUnavailable',
  unexpected_error: 'queries.edit.errors.unexpected'
}

const buildValidationErrorResponse = (
  error: SavedSqlQueryIdValidationError
): GetSavedSqlQueryApiResponse => {
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
  code: Exclude<GetSavedSqlQueryApiResponse['code'], 'success' | 'invalid_input'>
): GetSavedSqlQueryApiResponse => {
  const messageKey = ERROR_MESSAGE_KEYS[code]

  return {
    ok: false,
    code,
    message: messageKey,
    messageKey
  }
}

export default defineEventHandler(async (event) => {
  const queryId = getRouterParam(event, 'queryId')
  const queryIdValidation = validateSavedSqlQueryId(queryId)

  if (!queryIdValidation.ok) {
    setResponseStatus(event, 400)

    return buildValidationErrorResponse(queryIdValidation)
  }

  try {
    const authContext = getAuthenticatedOrganizationContext(event)
    const result = await getSavedSqlQuery(
      authContext,
      queryIdValidation.data.queryId
    )

    if (result.ok) {
      setResponseStatus(event, 200)

      return {
        ok: true,
        code: 'success',
        message: 'queries.edit.success',
        messageKey: 'queries.edit.success',
        query: result.query
      }
    }

    if (result.code === 'not_found') {
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

import type {
  ListSavedSqlQueriesApiResponse
} from '../../types/saved-sql-queries'

import { listSavedSqlQueries } from '../../services/saved-sql-queries'
import { getAuthenticatedOrganizationContext } from '../../utils/auth-organization'

const ERROR_MESSAGE_KEYS: Record<
  Exclude<ListSavedSqlQueriesApiResponse['code'], 'success'>,
  string
> = {
  forbidden: 'queries.list.errors.forbidden',
  persistence_unavailable: 'queries.list.errors.persistenceUnavailable',
  unexpected_error: 'queries.list.errors.unexpected'
}

const buildErrorResponse = (
  code: Exclude<ListSavedSqlQueriesApiResponse['code'], 'success'>
): ListSavedSqlQueriesApiResponse => {
  const messageKey = ERROR_MESSAGE_KEYS[code]

  return {
    ok: false,
    code,
    message: messageKey,
    messageKey
  }
}

export default defineEventHandler(async (event) => {
  try {
    const authContext = getAuthenticatedOrganizationContext(event)
    const result = await listSavedSqlQueries(authContext)

    if (result.ok) {
      setResponseStatus(event, 200)

      return {
        ok: true,
        code: 'success',
        message: 'queries.list.success',
        messageKey: 'queries.list.success',
        queries: result.queries
      }
    }

    if (result.code === 'persistence_unavailable') {
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

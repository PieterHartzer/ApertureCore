import type {
  ListSavedDatabaseConnectionsApiResponse
} from '../../types/database-connections'

import { listSavedDatabaseConnections } from '../../services/database-connections'
import { getAuthenticatedOrganizationContext } from '../../utils/auth-organization'

const ERROR_MESSAGE_KEYS: Record<
  Exclude<ListSavedDatabaseConnectionsApiResponse['code'], 'success'>,
  string
> = {
  forbidden: 'connections.list.errors.forbidden',
  persistence_unavailable: 'connections.list.errors.persistenceUnavailable',
  unexpected_error: 'connections.list.errors.unexpected'
}

const buildErrorResponse = (
  code: Exclude<ListSavedDatabaseConnectionsApiResponse['code'], 'success'>
): ListSavedDatabaseConnectionsApiResponse => {
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
    const result = await listSavedDatabaseConnections(authContext)

    if (result.ok) {
      setResponseStatus(event, 200)

      return {
        ok: true,
        code: 'success',
        message: 'connections.list.success',
        messageKey: 'connections.list.success',
        connections: result.connections
      }
    }

    switch (result.code) {
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

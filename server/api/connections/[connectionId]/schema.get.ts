import { getDatabaseSchema } from '../../../services/database-schema'
import { getAuthenticatedOrganizationContext } from '../../../utils/auth-organization'
import { isUuid } from '../../../utils/is-uuid'
import { consumeAuthenticatedFixedWindowRateLimit } from '../../../utils/authenticated-rate-limit'

export default defineEventHandler(async (event) => {
  const context = getAuthenticatedOrganizationContext(event)
  const connectionId = getRouterParam(event, 'connectionId') ?? ''
  if (!isUuid(connectionId)) throw createError({ statusCode: 400, statusMessage: 'Invalid connection.' })
  const limit = await consumeAuthenticatedFixedWindowRateLimit(event, {
    keyPrefix: 'rate-limit:connections:schema', limit: 10, windowMs: 60_000
  })
  if (!limit.allowed) {
    setResponseHeader(event, 'retry-after', limit.retryAfterSeconds)
    throw createError({ statusCode: 429, statusMessage: 'Please wait before loading the schema again.' })
  }
  const result = await getDatabaseSchema(context, connectionId)
  if (!result.ok) {
    const messages: Record<string, string> = {
      connection_failed: 'The database server could not be reached. Check that it is running and that the saved hostname and port are reachable from the app server.',
      authentication_failed: 'The database rejected the saved credentials. Update the username and password in connection settings.',
      database_not_found: 'The saved database name does not exist on this server. Check connection settings.',
      saved_connection_not_found: 'This connection is no longer available. Select another connection.',
      persistence_unavailable: 'Saved connection credentials are unavailable. Check the application database and its encryption key configuration.',
      timeout: 'Reading the schema timed out. Check the database connection and retry.',
      query_failed: 'The database could not return its schema. Check the database user’s access to schema metadata.'
    }
    setResponseStatus(event, result.code === 'saved_connection_not_found' ? 404 : result.code === 'connection_failed' ? 503 : 400)
    return { ok: false, code: result.code, message: result.code === 'schema_too_large' ? result.message : messages[result.code] ?? 'Could not read the database schema. Check the connection and its permissions.' }
  }
  return result
})

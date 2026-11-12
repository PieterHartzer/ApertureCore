import { useRuntimeConfig } from '#imports'

import type { AuthenticatedOrganizationContext } from '../types/database-connections'
import type { ExplainSavedSqlQueryInput, ExplainSavedSqlQueryResult } from '../types/saved-sql-queries'
import { getAppDatabase } from '../utils/app-database'
import { decryptSavedDatabaseConnectionSecret } from '../utils/database-connection-secrets'
import { resolvePositiveInteger } from '../utils/positive-integer'
import { explainDatabaseQuery } from './database'
import { mapOrganizationIdToStorage } from './organization'
import {
  isPersistenceConfigurationError,
  toClientVisibleQueryTestDetails,
  type SavedSqlQueryExecutionConnectionRow
} from './saved-sql-queries'

const DEFAULT_EXPLAIN_TIMEOUT_MS = 10_000

/**
 * The database's plan for SQL on one of the organization's connections. With
 * analyze the query runs under the same read-only rules and time limit as a
 * dashboard, so slow queries can be measured too.
 */
export const explainSavedSqlQuery = async (
  authContext: AuthenticatedOrganizationContext,
  input: ExplainSavedSqlQueryInput
): Promise<ExplainSavedSqlQueryResult> => {
  try {
    const db = getAppDatabase()
    const organizationId = mapOrganizationIdToStorage(authContext.organizationId)
    const connection = await db
      .selectFrom('app_database_connections')
      .select(['connection_id', 'database_type', 'encrypted_secret'])
      .where('organization_id', '=', organizationId)
      .where('connection_id', '=', input.connectionId)
      .where('deleted_at', 'is', null)
      .executeTakeFirst() as SavedSqlQueryExecutionConnectionRow | undefined

    if (!connection) {
      return { ok: false, code: 'saved_connection_not_found', message: 'saved_connection_not_found' }
    }

    const secret = decryptSavedDatabaseConnectionSecret(connection.encrypted_secret)
    const result = await explainDatabaseQuery({
      databaseType: connection.database_type,
      host: secret.host,
      port: secret.port,
      databaseName: secret.databaseName,
      username: secret.username,
      password: secret.password,
      sslMode: secret.sslMode,
      sql: input.sql,
      analyze: input.analyze,
      timeoutMs: resolvePositiveInteger(useRuntimeConfig().queryTimeoutMs, DEFAULT_EXPLAIN_TIMEOUT_MS)
    })

    if (!result.ok) {
      return {
        ok: false,
        code: result.code,
        message: result.message,
        // Our own message about the missing permission is safe to show as written.
        details: result.code === 'permission_denied' ? result.details : toClientVisibleQueryTestDetails(result.code, result.details)
      }
    }

    return { ok: true, code: 'success', plan: result.plan }
  } catch (error) {
    if (isPersistenceConfigurationError(error)) {
      return { ok: false, code: 'persistence_unavailable', message: 'persistence_unavailable' }
    }

    console.error(error)

    return { ok: false, code: 'unexpected_error', message: 'unexpected_error' }
  }
}

import { useRuntimeConfig } from '#imports'

import { executeDatabaseReadOnlyQuery } from '../../services/database'
import { mapOrganizationIdToStorage } from '../../services/organization'
import type { AuthenticatedOrganizationContext } from '../../types/database-connections'
import type { DatabaseType } from '../../types/database'
import type {
  RunSavedSqlQueryInput,
  RunSavedSqlQueryResult,
  RunSavedSqlQueryResultCode
} from '../../types/saved-sql-queries'
import {
  AppDatabaseConfigurationError,
  getAppDatabase
} from '../app-database'
import {
  DatabaseConnectionEncryptionConfigurationError,
  decryptSavedDatabaseConnectionSecret
} from '../database-connection-secrets'
import {
  SavedSqlQueryEncryptionConfigurationError,
  decryptSavedSqlQuerySecret
} from '../saved-sql-query-secrets'
import { resolvePositiveInteger } from '../positive-integer'

export interface QueryExecutionResourceRow {
  encrypted_sql: string
  database_type: DatabaseType
  encrypted_secret: string
}

const DEFAULT_MAX_QUERY_ROWS = 1000
const DEFAULT_QUERY_TIMEOUT_MS = 10_000

const isPersistenceConfigurationError = (value: unknown) => {
  return (
    value instanceof AppDatabaseConfigurationError ||
    value instanceof DatabaseConnectionEncryptionConfigurationError ||
    value instanceof SavedSqlQueryEncryptionConfigurationError
  )
}

export type ResolvedSavedQueryExecutionResult =
  | Extract<RunSavedSqlQueryResult, { ok: true }>
  | {
      ok: false
      code: Exclude<RunSavedSqlQueryResultCode, 'success' | 'forbidden'>
      message: string
      details?: string
    }

export const executeResolvedSavedQuery = async (
  executionResource: QueryExecutionResourceRow
): Promise<ResolvedSavedQueryExecutionResult> => {
  try {
    const runtimeConfig = useRuntimeConfig()
    const sql = decryptSavedSqlQuerySecret(executionResource.encrypted_sql).sql
    const secret = decryptSavedDatabaseConnectionSecret(
      executionResource.encrypted_secret
    )
    const result = await executeDatabaseReadOnlyQuery({
      databaseType: executionResource.database_type,
      host: secret.host,
      port: secret.port,
      databaseName: secret.databaseName,
      username: secret.username,
      password: secret.password,
      sslMode: secret.sslMode,
      sql,
      maxRows: resolvePositiveInteger(
        runtimeConfig.maxQueryRows,
        DEFAULT_MAX_QUERY_ROWS
      ),
      timeoutMs: resolvePositiveInteger(
        runtimeConfig.queryTimeoutMs,
        DEFAULT_QUERY_TIMEOUT_MS
      )
    })

    if (!result.ok) {
      return {
        ok: false,
        code: result.code,
        message: result.message,
        details: result.details
      }
    }

    return {
      ok: true,
      code: 'success',
      columns: result.columns,
      rows: result.rows,
      rowLimit: result.rowLimit
    }
  } catch (error) {
    if (isPersistenceConfigurationError(error)) {
      return {
        ok: false,
        code: 'persistence_unavailable',
        message: 'persistence_unavailable'
      }
    }

    console.error(error)

    return {
      ok: false,
      code: 'unexpected_error',
      message: 'unexpected_error'
    }
  }
}

/**
 * Executes a saved SQL query for the authenticated organization against its
 * persisted saved connection with shared row and timeout limits applied.
 */
export const executeQuery = async (
  authContext: AuthenticatedOrganizationContext,
  input: RunSavedSqlQueryInput
): Promise<RunSavedSqlQueryResult> => {
  try {
    const db = getAppDatabase()
    const organizationId = mapOrganizationIdToStorage(authContext.organizationId)
    const executionResource = await db
      .selectFrom('app_saved_sql_queries as query')
      .innerJoin('app_database_connections as connection', (join) =>
        join
          .onRef('connection.organization_id', '=', 'query.organization_id')
          .onRef('connection.connection_id', '=', 'query.connection_id')
      )
      .select([
        'query.encrypted_sql as encrypted_sql',
        'connection.database_type as database_type',
        'connection.encrypted_secret as encrypted_secret'
      ])
      .where('query.organization_id', '=', organizationId)
      .where('query.query_id', '=', input.queryId)
      .where('query.connection_id', '=', input.connectionId)
      .where('query.deleted_at', 'is', null)
      .where('connection.deleted_at', 'is', null)
      .executeTakeFirst() as QueryExecutionResourceRow | undefined

    if (!executionResource) {
      return {
        ok: false,
        code: 'forbidden',
        message: 'forbidden'
      }
    }

    return await executeResolvedSavedQuery(executionResource)
  } catch (error) {
    if (isPersistenceConfigurationError(error)) {
      return {
        ok: false,
        code: 'persistence_unavailable',
        message: 'persistence_unavailable'
      }
    }

    console.error(error)

    return {
      ok: false,
      code: 'unexpected_error',
      message: 'unexpected_error'
    }
  }
}

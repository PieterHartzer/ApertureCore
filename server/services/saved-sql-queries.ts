import { randomUUID } from 'node:crypto'

import type {
  AuthenticatedOrganizationContext,
  DeleteSavedSqlQueryInput,
  DeleteSavedSqlQueryResult,
  GetSavedSqlQueryResult,
  ListSavedSqlQueriesResult,
  SaveSavedSqlQueryInput,
  SaveSavedSqlQueryResult,
  SavedSqlQueryDetails,
  SavedSqlQuerySummary,
  TestSavedSqlQueryInput,
  TestSavedSqlQueryResult,
  UpdateSavedSqlQueryInput,
  UpdateSavedSqlQueryResult
} from '../types/saved-sql-queries'
import type { DatabaseType } from '../types/database'
import { testDatabaseReadOnlyQuery } from './database'
import {
  AppDatabaseConfigurationError,
  getAppDatabase
} from '../utils/app-database'
import {
  DatabaseConnectionEncryptionConfigurationError,
  decryptSavedDatabaseConnectionSecret
} from '../utils/database-connection-secrets'
import {
  SavedSqlQueryEncryptionConfigurationError,
  decryptSavedSqlQuerySecret,
  encryptSavedSqlQuerySecret
} from '../utils/saved-sql-query-secrets'
import {
  mapOrganizationIdToStorage,
  upsertOrganization
} from './organization'

interface SavedSqlQuerySummaryRow {
  query_id: string
  query_name: string
  connection_id: string
  connection_name: string
  created_at: Date
  updated_at: Date
}

interface SavedSqlQueryWriteRow {
  query_id: string
  query_name: string
  connection_id: string
  created_at: Date
  updated_at: Date
}

interface SavedSqlQueryDetailsRow {
  query_id: string
  query_name: string
  connection_id: string
  encrypted_sql: string
  created_at: Date
  updated_at: Date
}

interface SavedSqlQueryIdentityRow {
  query_id: string
  query_name: string
}

interface SavedSqlQueryConnectionRow {
  connection_id: string
  connection_name: string
}

interface SavedSqlQueryExecutionConnectionRow {
  connection_id: string
  database_type: DatabaseType
  encrypted_secret: string
}

const MAX_QUERY_TEST_DETAILS_LENGTH = 500

const UNIQUE_QUERY_NAME_CONSTRAINT =
  'app_saved_sql_queries_unique_name_per_connection'
const CONNECTION_FOREIGN_KEY_CONSTRAINT =
  'app_saved_sql_queries_organization_connection_fkey'

const mapSavedSqlQuerySummary = (
  row: SavedSqlQuerySummaryRow
): SavedSqlQuerySummary => ({
  id: row.query_id,
  queryName: row.query_name,
  connectionId: row.connection_id,
  connectionName: row.connection_name,
  createdAt: new Date(row.created_at).toISOString(),
  updatedAt: new Date(row.updated_at).toISOString()
})

const mapSavedSqlQuerySummaryFromWrite = (
  row: SavedSqlQueryWriteRow,
  connectionName: string
): SavedSqlQuerySummary => ({
  id: row.query_id,
  queryName: row.query_name,
  connectionId: row.connection_id,
  connectionName,
  createdAt: new Date(row.created_at).toISOString(),
  updatedAt: new Date(row.updated_at).toISOString()
})

const mapSavedSqlQueryDetails = (
  row: SavedSqlQueryDetailsRow,
  sql: string
): SavedSqlQueryDetails => ({
  id: row.query_id,
  queryName: row.query_name,
  connectionId: row.connection_id,
  sql,
  createdAt: new Date(row.created_at).toISOString(),
  updatedAt: new Date(row.updated_at).toISOString()
})

const isPostgresError = (
  value: unknown
): value is { code?: string, constraint?: string } => {
  return typeof value === 'object' && value !== null && 'code' in value
}

const isPersistenceConfigurationError = (value: unknown) => {
  return (
    value instanceof AppDatabaseConfigurationError ||
    value instanceof DatabaseConnectionEncryptionConfigurationError ||
    value instanceof SavedSqlQueryEncryptionConfigurationError
  )
}

const isConnectionForeignKeyError = (value: unknown) => {
  return (
    isPostgresError(value) &&
    value.code === '23503' &&
    value.constraint === CONNECTION_FOREIGN_KEY_CONSTRAINT
  )
}

const isDuplicateQueryNameError = (value: unknown) => {
  return (
    isPostgresError(value) &&
    value.code === '23505' &&
    value.constraint === UNIQUE_QUERY_NAME_CONSTRAINT
  )
}

const toClientVisibleQueryTestDetails = (
  code: Exclude<TestSavedSqlQueryResult['code'], 'success'>,
  details?: string
) => {
  if (!details || (code !== 'query_rejected' && code !== 'query_failed')) {
    return undefined
  }

  const normalizedDetails = Array.from(details, (character) => {
    const codePoint = character.charCodeAt(0)

    return codePoint < 32 || codePoint === 127
      ? ' '
      : character
  }).join('')
    .replace(/\s+/g, ' ')
    .trim()

  if (!normalizedDetails) {
    return undefined
  }

  if (normalizedDetails.length <= MAX_QUERY_TEST_DETAILS_LENGTH) {
    return normalizedDetails
  }

  return `${normalizedDetails.slice(0, MAX_QUERY_TEST_DETAILS_LENGTH)}...`
}

const loadSavedSqlQueryConnection = async (
  db: ReturnType<typeof getAppDatabase>,
  organizationId: string,
  connectionId: string
) => {
  return await db
    .selectFrom('app_database_connections')
    .select(['connection_id', 'connection_name'])
    .where('organization_id', '=', organizationId)
    .where('connection_id', '=', connectionId)
    .where('deleted_at', 'is', null)
    .executeTakeFirst() as SavedSqlQueryConnectionRow | undefined
}

/**
 * Executes a saved SQL query against the selected saved connection using a
 * read-only, row-limited database session.
 */
export const testSavedSqlQuery = async (
  authContext: AuthenticatedOrganizationContext,
  input: TestSavedSqlQueryInput
): Promise<TestSavedSqlQueryResult> => {
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
      return {
        ok: false,
        code: 'saved_connection_not_found',
        message: 'saved_connection_not_found'
      }
    }

    const secret = decryptSavedDatabaseConnectionSecret(connection.encrypted_secret)
    const result = await testDatabaseReadOnlyQuery({
      databaseType: connection.database_type,
      host: secret.host,
      port: secret.port,
      databaseName: secret.databaseName,
      username: secret.username,
      password: secret.password,
      sslMode: secret.sslMode,
      sql: input.sql
    })

    if (!result.ok) {
      const details = toClientVisibleQueryTestDetails(
        result.code,
        result.details
      )

      return {
        ok: false,
        code: result.code,
        message: result.message,
        details
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
 * Persists a saved SQL query for the authenticated organization, encrypting
 * the raw SQL payload before it reaches storage.
 */
export const saveSavedSqlQuery = async (
  authContext: AuthenticatedOrganizationContext,
  input: SaveSavedSqlQueryInput
): Promise<SaveSavedSqlQueryResult> => {
  try {
    await upsertOrganization(authContext)

    const db = getAppDatabase()
    const organizationId = mapOrganizationIdToStorage(authContext.organizationId)
    const connection = await loadSavedSqlQueryConnection(
      db,
      organizationId,
      input.connectionId
    )

    if (!connection) {
      return {
        ok: false,
        code: 'not_found',
        message: 'not_found'
      }
    }

    const encryptedSql = encryptSavedSqlQuerySecret({
      sql: input.sql
    })
    const savedQuery = await db
      .insertInto('app_saved_sql_queries')
      .values({
        query_id: randomUUID(),
        organization_id: organizationId,
        connection_id: connection.connection_id,
        query_name: input.queryName,
        encrypted_sql: encryptedSql,
        created_by_user_id: authContext.userId,
        updated_by_user_id: authContext.userId
      })
      .returning([
        'query_id',
        'query_name',
        'connection_id',
        'created_at',
        'updated_at'
      ])
      .executeTakeFirst() as SavedSqlQueryWriteRow | undefined

    if (!savedQuery) {
      return {
        ok: false,
        code: 'unexpected_error',
        message: 'unexpected_error'
      }
    }

    return {
      ok: true,
      code: 'success',
      query: mapSavedSqlQuerySummaryFromWrite(
        savedQuery,
        connection.connection_name
      )
    }
  } catch (error) {
    if (isPersistenceConfigurationError(error)) {
      return {
        ok: false,
        code: 'persistence_unavailable',
        message: 'persistence_unavailable'
      }
    }

    if (isConnectionForeignKeyError(error)) {
      return {
        ok: false,
        code: 'not_found',
        message: 'not_found'
      }
    }

    if (isDuplicateQueryNameError(error)) {
      return {
        ok: false,
        code: 'duplicate_query_name',
        message: 'duplicate_query_name'
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
 * Returns an explicitly requested saved SQL query and decrypts the stored SQL
 * payload only for this edit-time UI read path.
 */
export const getSavedSqlQuery = async (
  authContext: AuthenticatedOrganizationContext,
  queryId: string
): Promise<GetSavedSqlQueryResult> => {
  try {
    const db = getAppDatabase()
    const organizationId = mapOrganizationIdToStorage(authContext.organizationId)
    const query = await db
      .selectFrom('app_saved_sql_queries')
      .select([
        'query_id',
        'query_name',
        'connection_id',
        'encrypted_sql',
        'created_at',
        'updated_at'
      ])
      .where('organization_id', '=', organizationId)
      .where('query_id', '=', queryId)
      .where('deleted_at', 'is', null)
      .executeTakeFirst() as SavedSqlQueryDetailsRow | undefined

    if (!query) {
      return {
        ok: false,
        code: 'not_found',
        message: 'not_found'
      }
    }

    return {
      ok: true,
      code: 'success',
      query: mapSavedSqlQueryDetails(
        query,
        decryptSavedSqlQuerySecret(query.encrypted_sql).sql
      )
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
 * Updates a saved SQL query for the authenticated organization and stores the
 * SQL payload only in encrypted form.
 */
export const updateSavedSqlQuery = async (
  authContext: AuthenticatedOrganizationContext,
  input: UpdateSavedSqlQueryInput
): Promise<UpdateSavedSqlQueryResult> => {
  try {
    const db = getAppDatabase()
    const organizationId = mapOrganizationIdToStorage(authContext.organizationId)
    const existingQuery = await db
      .selectFrom('app_saved_sql_queries')
      .select(['query_id'])
      .where('organization_id', '=', organizationId)
      .where('query_id', '=', input.queryId)
      .where('deleted_at', 'is', null)
      .executeTakeFirst()

    if (!existingQuery) {
      return {
        ok: false,
        code: 'not_found',
        message: 'not_found'
      }
    }

    const connection = await loadSavedSqlQueryConnection(
      db,
      organizationId,
      input.connectionId
    )

    if (!connection) {
      return {
        ok: false,
        code: 'not_found',
        message: 'not_found'
      }
    }

    const encryptedSql = encryptSavedSqlQuerySecret({
      sql: input.sql
    })
    const updatedQuery = await db
      .updateTable('app_saved_sql_queries')
      .set({
        connection_id: connection.connection_id,
        query_name: input.queryName,
        encrypted_sql: encryptedSql,
        updated_by_user_id: authContext.userId
      })
      .where('organization_id', '=', organizationId)
      .where('query_id', '=', input.queryId)
      .where('deleted_at', 'is', null)
      .returning([
        'query_id',
        'query_name',
        'connection_id',
        'created_at',
        'updated_at'
      ])
      .executeTakeFirst() as SavedSqlQueryWriteRow | undefined

    if (!updatedQuery) {
      return {
        ok: false,
        code: 'not_found',
        message: 'not_found'
      }
    }

    return {
      ok: true,
      code: 'success',
      query: mapSavedSqlQuerySummaryFromWrite(
        updatedQuery,
        connection.connection_name
      )
    }
  } catch (error) {
    if (isPersistenceConfigurationError(error)) {
      return {
        ok: false,
        code: 'persistence_unavailable',
        message: 'persistence_unavailable'
      }
    }

    if (isConnectionForeignKeyError(error)) {
      return {
        ok: false,
        code: 'not_found',
        message: 'not_found'
      }
    }

    if (isDuplicateQueryNameError(error)) {
      return {
        ok: false,
        code: 'duplicate_query_name',
        message: 'duplicate_query_name'
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
 * Soft deletes a saved SQL query for the authenticated organization after the
 * caller confirms the visible query name.
 */
export const deleteSavedSqlQuery = async (
  authContext: AuthenticatedOrganizationContext,
  input: DeleteSavedSqlQueryInput
): Promise<DeleteSavedSqlQueryResult> => {
  try {
    const db = getAppDatabase()
    const organizationId = mapOrganizationIdToStorage(authContext.organizationId)
    const query = await db
      .selectFrom('app_saved_sql_queries')
      .select(['query_id', 'query_name'])
      .where('organization_id', '=', organizationId)
      .where('query_id', '=', input.queryId)
      .where('deleted_at', 'is', null)
      .executeTakeFirst() as SavedSqlQueryIdentityRow | undefined

    if (!query) {
      return {
        ok: false,
        code: 'not_found',
        message: 'not_found'
      }
    }

    if (query.query_name !== input.confirmationName) {
      return {
        ok: false,
        code: 'confirmation_mismatch',
        message: 'confirmation_mismatch'
      }
    }

    await db
      .updateTable('app_saved_sql_queries')
      .set({
        deleted_at: new Date(),
        updated_by_user_id: authContext.userId
      })
      .where('organization_id', '=', organizationId)
      .where('query_id', '=', input.queryId)
      .where('deleted_at', 'is', null)
      .executeTakeFirst()

    return {
      ok: true,
      code: 'success'
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
 * Returns saved SQL query summaries for the authenticated organization without
 * selecting or exposing the encrypted SQL payload.
 */
export const listSavedSqlQueries = async (
  authContext: AuthenticatedOrganizationContext
): Promise<ListSavedSqlQueriesResult> => {
  try {
    const db = getAppDatabase()
    const organizationId = mapOrganizationIdToStorage(authContext.organizationId)
    const queries = await db
      .selectFrom('app_saved_sql_queries as query')
      .innerJoin('app_database_connections as connection', (join) =>
        join
          .onRef('connection.organization_id', '=', 'query.organization_id')
          .onRef('connection.connection_id', '=', 'query.connection_id')
      )
      .select([
        'query.query_id as query_id',
        'query.query_name as query_name',
        'query.connection_id as connection_id',
        'connection.connection_name as connection_name',
        'query.created_at as created_at',
        'query.updated_at as updated_at'
      ])
      .where('query.organization_id', '=', organizationId)
      .where('query.deleted_at', 'is', null)
      .where('connection.deleted_at', 'is', null)
      .orderBy('query.updated_at', 'desc')
      .orderBy('query.query_name', 'asc')
      .execute() as SavedSqlQuerySummaryRow[]

    return {
      ok: true,
      code: 'success',
      queries: queries.map(mapSavedSqlQuerySummary)
    }
  } catch (error) {
    if (error instanceof AppDatabaseConfigurationError) {
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

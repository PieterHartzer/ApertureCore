import { createHash, randomUUID } from 'node:crypto'

import type {
  AuthenticatedOrganizationContext,
  ListSavedDatabaseConnectionsResult,
  SaveDatabaseConnectionInput,
  SaveDatabaseConnectionResult,
  SavedDatabaseConnectionSummary
} from '../types/database-connections'
import type { DatabaseType } from '../types/database'
import {
  DatabaseConnectionEncryptionConfigurationError,
  encryptSavedDatabaseConnectionSecret
} from '../utils/database-connection-secrets'
import {
  AppDatabaseConfigurationError,
  getAppDatabase
} from '../utils/app-database'
import { upsertOrganization, mapOrganizationIdToStorage } from './organization'

interface DatabaseConnectionRow {
  connection_id: string
  connection_name: string
  database_type: string
  created_at: Date
  updated_at: Date
}

const UNIQUE_NAME_CONSTRAINT = 'app_database_connections_unique_name_per_org'
const UNIQUE_TARGET_CONSTRAINT = 'app_database_connections_unique_target_per_org'

const mapStoredDatabaseType = (databaseType: string): DatabaseType => {
  switch (databaseType) {
    case 'postgres':
    case 'postgresql':
      return 'postgresql'
    default:
      return databaseType as DatabaseType
  }
}

const mapDatabaseTypeToStorage = (databaseType: DatabaseType): string => {
  switch (databaseType) {
    case 'postgresql':
      return 'postgres'
  }
}

const mapSavedDatabaseConnectionSummary = (
  row: DatabaseConnectionRow
): SavedDatabaseConnectionSummary => ({
  id: row.connection_id,
  connectionName: row.connection_name,
  databaseType: mapStoredDatabaseType(row.database_type),
  createdAt: new Date(row.created_at).toISOString(),
  updatedAt: new Date(row.updated_at).toISOString()
})

/**
 * Produces a deterministic org-scoped uniqueness key for a connection target
 * without storing the raw host/database pair in plaintext columns.
 */
const buildConnectionTargetFingerprint = (
  input: Pick<SaveDatabaseConnectionInput, 'host' | 'databaseName'>
) => {
  return createHash('sha256')
    .update(`${input.host}\u0000${input.databaseName}`, 'utf8')
    .digest('hex')
}

const isPostgresError = (
  value: unknown
): value is { code?: string, constraint?: string } => {
  return typeof value === 'object' && value !== null && 'code' in value
}

const isPersistenceConfigurationError = (value: unknown) => {
  return (
    value instanceof AppDatabaseConfigurationError ||
    value instanceof DatabaseConnectionEncryptionConfigurationError
  )
}

/**
 * Persists a connection for the authenticated organization and maps expected
 * storage failures to stable application error codes.
 */
export const saveDatabaseConnection = async (
  authContext: AuthenticatedOrganizationContext,
  input: SaveDatabaseConnectionInput
): Promise<SaveDatabaseConnectionResult> => {
  try {
    await upsertOrganization(authContext)

    const encryptedSecret = encryptSavedDatabaseConnectionSecret({
      host: input.host,
      port: input.port ?? 5432,
      databaseName: input.databaseName,
      username: input.username,
      password: input.password,
      sslMode: input.sslMode
    })

    const db = getAppDatabase()
    const organizationId = mapOrganizationIdToStorage(authContext.organizationId)
    const savedConnection = await db
      .insertInto('app_database_connections')
      .values({
        connection_id: randomUUID(),
        organization_id: organizationId,
        connection_name: input.connectionName,
        connection_target_fingerprint: buildConnectionTargetFingerprint(input),
        database_type: mapDatabaseTypeToStorage(input.databaseType),
        encrypted_secret: encryptedSecret,
        created_by_user_id: authContext.userId,
        updated_by_user_id: authContext.userId
      })
      .returningAll()
      .executeTakeFirst()

    if (!savedConnection) {
      return {
        ok: false,
        code: 'unexpected_error',
        message: 'unexpected_error'
      }
    }

    return {
      ok: true,
      code: 'success',
      connection: mapSavedDatabaseConnectionSummary(savedConnection)
    }
  } catch (error) {
    if (isPersistenceConfigurationError(error)) {
      return {
        ok: false,
        code: 'persistence_unavailable',
        message: 'persistence_unavailable'
      }
    }

    if (isPostgresError(error) && error.code === '23505') {
      if (error.constraint === UNIQUE_NAME_CONSTRAINT) {
        return {
          ok: false,
          code: 'duplicate_connection_name',
          message: 'duplicate_connection_name'
        }
      }

      if (error.constraint === UNIQUE_TARGET_CONSTRAINT) {
        return {
          ok: false,
          code: 'duplicate_connection_target',
          message: 'duplicate_connection_target'
        }
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
 * Returns saved connection summaries for the authenticated organization.
 */
export const listSavedDatabaseConnections = async (
  authContext: AuthenticatedOrganizationContext
): Promise<ListSavedDatabaseConnectionsResult> => {
  try {
    const db = getAppDatabase()
    const organizationId = mapOrganizationIdToStorage(authContext.organizationId)
    const connections = await db
      .selectFrom('app_database_connections')
      .select(['connection_id', 'connection_name', 'database_type', 'created_at', 'updated_at'])
      .where('organization_id', '=', organizationId)
      .orderBy('created_at', 'desc')
      .orderBy('connection_name', 'asc')
      .execute()

    return {
      ok: true,
      code: 'success',
      connections: connections.map(mapSavedDatabaseConnectionSummary)
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

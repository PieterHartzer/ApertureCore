import { createHash, randomUUID } from 'node:crypto'

import type {
  DeleteDatabaseConnectionInput,
  DeleteDatabaseConnectionResult,
  AuthenticatedOrganizationContext,
  GetSavedDatabaseConnectionResult,
  ListSavedDatabaseConnectionsResult,
  SaveDatabaseConnectionInput,
  SaveDatabaseConnectionResult,
  SavedDatabaseConnectionDetails,
  SavedDatabaseConnectionSecret,
  SavedDatabaseConnectionSummary,
  UpdateDatabaseConnectionInput,
  UpdateDatabaseConnectionResult
} from '../types/database-connections'
import type { DatabaseType } from '../types/database'
import {
  DatabaseConnectionEncryptionConfigurationError,
  decryptSavedDatabaseConnectionSecret,
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
  database_type: DatabaseType
  created_at: Date
  updated_at: Date
}

interface DatabaseConnectionDetailsRow {
  connection_id: string
  connection_name: string
  database_type: DatabaseType
  encrypted_secret: string
}

interface DatabaseConnectionIdentityRow {
  connection_id: string
  connection_name: string
}

interface DatabaseConnectionSecretRow {
  connection_id: string
  encrypted_secret: string
}

interface SavedDatabaseConnectionSecretLookupResult {
  ok: true
  code: 'success'
  secret: SavedDatabaseConnectionSecret
}

interface SavedDatabaseConnectionSecretLookupError {
  ok: false
  code: 'not_found' | 'persistence_unavailable' | 'unexpected_error'
  message: string
}

const UNIQUE_NAME_CONSTRAINT = 'app_database_connections_unique_name_per_org'
const UNIQUE_TARGET_CONSTRAINT = 'app_database_connections_unique_target_per_org'

const mapSavedDatabaseConnectionSummary = (
  row: DatabaseConnectionRow
): SavedDatabaseConnectionSummary => ({
  id: row.connection_id,
  connectionName: row.connection_name,
  databaseType: row.database_type,
  createdAt: new Date(row.created_at).toISOString(),
  updatedAt: new Date(row.updated_at).toISOString()
})

const mapSavedDatabaseConnectionDetails = (
  row: DatabaseConnectionDetailsRow,
  secret: SavedDatabaseConnectionSecret
): SavedDatabaseConnectionDetails => ({
  id: row.connection_id,
  connectionName: row.connection_name,
  databaseType: row.database_type,
  host: secret.host,
  port: secret.port,
  databaseName: secret.databaseName,
  username: secret.username,
  sslMode: secret.sslMode,
  hasPassword: Boolean(secret.password)
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

const getDuplicateConnectionErrorCode = (
  value: unknown
): 'duplicate_connection_name' | 'duplicate_connection_target' | undefined => {
  if (!(isPostgresError(value) && value.code === '23505')) {
    return undefined
  }

  switch (value.constraint) {
    case UNIQUE_NAME_CONSTRAINT:
      return 'duplicate_connection_name'
    case UNIQUE_TARGET_CONSTRAINT:
      return 'duplicate_connection_target'
    default:
      return undefined
  }
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
      port: input.port,
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
        database_type: input.databaseType,
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

    const duplicateErrorCode = getDuplicateConnectionErrorCode(error)

    if (duplicateErrorCode) {
      return {
        ok: false,
        code: duplicateErrorCode,
        message: duplicateErrorCode
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
 * Returns the editable details for a saved connection in the authenticated
 * organization without exposing the stored password.
 */
export const getSavedDatabaseConnection = async (
  authContext: AuthenticatedOrganizationContext,
  connectionId: string
): Promise<GetSavedDatabaseConnectionResult> => {
  try {
    const db = getAppDatabase()
    const organizationId = mapOrganizationIdToStorage(authContext.organizationId)
    const connection = await db
      .selectFrom('app_database_connections')
      .select([
        'connection_id',
        'connection_name',
        'database_type',
        'encrypted_secret'
      ])
      .where('organization_id', '=', organizationId)
      .where('connection_id', '=', connectionId)
      .where('deleted_at', 'is', null)
      .executeTakeFirst() as DatabaseConnectionDetailsRow | undefined

    if (!connection) {
      return {
        ok: false,
        code: 'not_found',
        message: 'not_found'
      }
    }

    return {
      ok: true,
      code: 'success',
      connection: mapSavedDatabaseConnectionDetails(
        connection,
        decryptSavedDatabaseConnectionSecret(connection.encrypted_secret)
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
 * Returns the decrypted stored secret for a saved connection in the
 * authenticated organization for server-side workflows such as edit-time tests.
 */
export const getSavedDatabaseConnectionSecret = async (
  authContext: AuthenticatedOrganizationContext,
  connectionId: string
): Promise<
  SavedDatabaseConnectionSecretLookupResult | SavedDatabaseConnectionSecretLookupError
> => {
  try {
    const db = getAppDatabase()
    const organizationId = mapOrganizationIdToStorage(authContext.organizationId)
    const connection = await db
      .selectFrom('app_database_connections')
      .select(['connection_id', 'encrypted_secret'])
      .where('organization_id', '=', organizationId)
      .where('connection_id', '=', connectionId)
      .where('deleted_at', 'is', null)
      .executeTakeFirst() as DatabaseConnectionSecretRow | undefined

    if (!connection) {
      return {
        ok: false,
        code: 'not_found',
        message: 'not_found'
      }
    }

    return {
      ok: true,
      code: 'success',
      secret: decryptSavedDatabaseConnectionSecret(connection.encrypted_secret)
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
      .where('deleted_at', 'is', null)
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

/**
 * Updates a saved connection for the authenticated organization. When the
 * request omits a password, the existing stored password is preserved.
 */
export const updateDatabaseConnection = async (
  authContext: AuthenticatedOrganizationContext,
  input: UpdateDatabaseConnectionInput
): Promise<UpdateDatabaseConnectionResult> => {
  try {
    const db = getAppDatabase()
    const organizationId = mapOrganizationIdToStorage(authContext.organizationId)
    const existingConnection = await db
      .selectFrom('app_database_connections')
      .select(['connection_id', 'encrypted_secret'])
      .where('organization_id', '=', organizationId)
      .where('connection_id', '=', input.connectionId)
      .where('deleted_at', 'is', null)
      .executeTakeFirst() as DatabaseConnectionSecretRow | undefined

    if (!existingConnection) {
      return {
        ok: false,
        code: 'not_found',
        message: 'not_found'
      }
    }

    const existingSecret = decryptSavedDatabaseConnectionSecret(
      existingConnection.encrypted_secret
    )
    const encryptedSecret = encryptSavedDatabaseConnectionSecret({
      host: input.host,
      port: input.port,
      databaseName: input.databaseName,
      username: input.username,
      password: input.password ?? existingSecret.password,
      sslMode: input.sslMode
    })

    const updatedConnection = await db
      .updateTable('app_database_connections')
      .set({
        connection_name: input.connectionName,
        connection_target_fingerprint: buildConnectionTargetFingerprint(input),
        database_type: input.databaseType,
        encrypted_secret: encryptedSecret,
        updated_by_user_id: authContext.userId
      })
      .where('organization_id', '=', organizationId)
      .where('connection_id', '=', input.connectionId)
      .where('deleted_at', 'is', null)
      .returningAll()
      .executeTakeFirst() as DatabaseConnectionRow | undefined

    if (!updatedConnection) {
      return {
        ok: false,
        code: 'not_found',
        message: 'not_found'
      }
    }

    return {
      ok: true,
      code: 'success',
      connection: mapSavedDatabaseConnectionSummary(updatedConnection)
    }
  } catch (error) {
    if (isPersistenceConfigurationError(error)) {
      return {
        ok: false,
        code: 'persistence_unavailable',
        message: 'persistence_unavailable'
      }
    }

    const duplicateErrorCode = getDuplicateConnectionErrorCode(error)

    if (duplicateErrorCode) {
      return {
        ok: false,
        code: duplicateErrorCode,
        message: duplicateErrorCode
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
 * Soft deletes a saved connection for the authenticated organization after the
 * caller confirms the visible connection name.
 */
export const deleteDatabaseConnection = async (
  authContext: AuthenticatedOrganizationContext,
  input: DeleteDatabaseConnectionInput
): Promise<DeleteDatabaseConnectionResult> => {
  try {
    const db = getAppDatabase()
    const organizationId = mapOrganizationIdToStorage(authContext.organizationId)
    const connection = await db
      .selectFrom('app_database_connections')
      .select(['connection_id', 'connection_name'])
      .where('organization_id', '=', organizationId)
      .where('connection_id', '=', input.connectionId)
      .where('deleted_at', 'is', null)
      .executeTakeFirst() as DatabaseConnectionIdentityRow | undefined

    if (!connection) {
      return {
        ok: false,
        code: 'not_found',
        message: 'not_found'
      }
    }

    if (connection.connection_name !== input.confirmationName) {
      return {
        ok: false,
        code: 'confirmation_mismatch',
        message: 'confirmation_mismatch'
      }
    }

    await db
      .updateTable('app_database_connections')
      .set({
        deleted_at: new Date(),
        updated_by_user_id: authContext.userId
      })
      .where('organization_id', '=', organizationId)
      .where('connection_id', '=', input.connectionId)
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

import { createDecipheriv, createHash } from 'node:crypto'

import { sql } from 'kysely'

const ENCRYPTION_ALGORITHM = 'aes-256-gcm'
const ENCRYPTION_VERSION = 'v1'
const UNIQUE_TARGET_INDEX = 'app_database_connections_unique_target_per_org'

/**
 * Derives the key needed to decrypt existing saved connection secrets during
 * backfill.
 */
const buildEncryptionKey = () => {
  const encryptionKey = process.env.APP_DATABASE_ENCRYPTION_KEY?.trim()

  if (!encryptionKey) {
    throw new Error(
      'APP_DATABASE_ENCRYPTION_KEY is required to backfill connection fingerprints.'
    )
  }

  return createHash('sha256')
    .update(encryptionKey, 'utf8')
    .digest()
}

/**
 * Decrypts a stored secret so the migration can derive the new indexed
 * uniqueness fingerprint from existing rows.
 */
const decryptSavedDatabaseConnectionSecret = (
  encryptedPayload,
  encryptionKey
) => {
  const [version, initializationVector, authTag, ciphertext] = encryptedPayload.split('.')

  if (
    version !== ENCRYPTION_VERSION ||
    !initializationVector ||
    !authTag ||
    !ciphertext
  ) {
    throw new Error('Saved database connection secret is invalid.')
  }

  const decipher = createDecipheriv(
    ENCRYPTION_ALGORITHM,
    encryptionKey,
    Buffer.from(initializationVector, 'base64url')
  )

  decipher.setAuthTag(Buffer.from(authTag, 'base64url'))

  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertext, 'base64url')),
    decipher.final()
  ]).toString('utf8')

  const parsedPayload = JSON.parse(plaintext)

  if (
    typeof parsedPayload !== 'object' ||
    parsedPayload === null ||
    typeof parsedPayload.host !== 'string' ||
    typeof parsedPayload.databaseName !== 'string'
  ) {
    throw new Error('Saved database connection secret is invalid.')
  }

  return parsedPayload
}

/**
 * Produces a deterministic value for enforcing uniqueness on host plus
 * database name without introducing plaintext columns for those fields.
 */
const buildConnectionTargetFingerprint = (host, databaseName) => {
  return createHash('sha256')
    .update(`${host}\u0000${databaseName}`, 'utf8')
    .digest('hex')
}

export const up = async (db) => {
  await db.schema
    .alterTable('app_database_connections')
    .addColumn('connection_target_fingerprint', 'text')
    .execute()

  const existingConnections = await db
    .selectFrom('app_database_connections')
    .select(['connection_id', 'encrypted_secret'])
    .execute()

  if (existingConnections.length > 0) {
    const encryptionKey = buildEncryptionKey()

    for (const connection of existingConnections) {
      const { host, databaseName } = decryptSavedDatabaseConnectionSecret(
        connection.encrypted_secret,
        encryptionKey
      )

      await db
        .updateTable('app_database_connections')
        .set({
          connection_target_fingerprint: buildConnectionTargetFingerprint(
            host,
            databaseName
          )
        })
        .where('connection_id', '=', connection.connection_id)
        .executeTakeFirst()
    }
  }

  await sql`
    alter table app_database_connections
    alter column connection_target_fingerprint set not null
  `.execute(db)

  await db.schema
    .createIndex(UNIQUE_TARGET_INDEX)
    .ifNotExists()
    .unique()
    .on('app_database_connections')
    .columns(['organization_id', 'connection_target_fingerprint'])
    .where('deleted_at', 'is', null)
    .execute()
}

export const down = async (db) => {
  await db.schema
    .dropIndex(UNIQUE_TARGET_INDEX)
    .ifExists()
    .execute()

  await sql`
    alter table app_database_connections
    drop column if exists connection_target_fingerprint
  `.execute(db)
}

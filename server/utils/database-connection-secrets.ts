import { useRuntimeConfig } from '#imports'
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes
} from 'node:crypto'

import type { SavedDatabaseConnectionSecret } from '../types/database-connections'

const ENCRYPTION_ALGORITHM = 'aes-256-gcm'
const ENCRYPTION_VERSION = 'v1'
const INITIALIZATION_VECTOR_SIZE = 12

export class DatabaseConnectionEncryptionConfigurationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DatabaseConnectionEncryptionConfigurationError'
  }
}

/**
 * Derives the symmetric encryption key for stored connection secrets from the
 * server-side runtime configuration.
 */
const buildEncryptionKey = () => {
  const { appDatabaseEncryptionKey } = useRuntimeConfig()

  if (!appDatabaseEncryptionKey.trim()) {
    throw new DatabaseConnectionEncryptionConfigurationError(
      'APP_DATABASE_ENCRYPTION_KEY is not configured.'
    )
  }

  return createHash('sha256')
    .update(appDatabaseEncryptionKey, 'utf8')
    .digest()
}

/**
 * Verifies that decrypted JSON matches the saved connection secret shape before
 * the payload is returned to application code.
 */
const isSavedDatabaseConnectionSecret = (
  value: unknown
): value is SavedDatabaseConnectionSecret => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }

  const record = value as Record<string, unknown>

  return (
    typeof record.host === 'string' &&
    typeof record.port === 'number' &&
    typeof record.databaseName === 'string' &&
    typeof record.username === 'string' &&
    typeof record.password === 'string' &&
    (record.sslMode === 'disable' || record.sslMode === 'require')
  )
}

/**
 * Encrypts the connection fields that should not be stored in plaintext.
 */
export const encryptSavedDatabaseConnectionSecret = (
  payload: SavedDatabaseConnectionSecret
) => {
  const initializationVector = randomBytes(INITIALIZATION_VECTOR_SIZE)
  const cipher = createCipheriv(
    ENCRYPTION_ALGORITHM,
    buildEncryptionKey(),
    initializationVector
  )

  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(payload), 'utf8'),
    cipher.final()
  ])

  const authTag = cipher.getAuthTag()

  return [
    ENCRYPTION_VERSION,
    initializationVector.toString('base64url'),
    authTag.toString('base64url'),
    ciphertext.toString('base64url')
  ].join('.')
}

/**
 * Decrypts a stored connection secret back into its structured connection
 * fields for server-side use.
 */
export const decryptSavedDatabaseConnectionSecret = (
  encryptedPayload: string
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
    buildEncryptionKey(),
    Buffer.from(initializationVector, 'base64url')
  )

  decipher.setAuthTag(Buffer.from(authTag, 'base64url'))

  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertext, 'base64url')),
    decipher.final()
  ]).toString('utf8')

  const parsedPayload = JSON.parse(plaintext) as unknown

  if (!isSavedDatabaseConnectionSecret(parsedPayload)) {
    throw new Error('Saved database connection secret is invalid.')
  }

  return parsedPayload
}

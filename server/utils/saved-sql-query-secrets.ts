import { useRuntimeConfig } from '#imports'
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes
} from 'node:crypto'

import type { SavedSqlQuerySecret } from '../types/saved-sql-queries'

const ENCRYPTION_ALGORITHM = 'aes-256-gcm'
const ENCRYPTION_CONTEXT = 'saved-sql-query-secret'
const ENCRYPTION_VERSION = 'v1'
const INITIALIZATION_VECTOR_SIZE = 12

export class SavedSqlQueryEncryptionConfigurationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SavedSqlQueryEncryptionConfigurationError'
  }
}

/**
 * Derives a dedicated encryption key for saved SQL payloads from the shared
 * application encryption secret using context separation.
 */
const buildEncryptionKey = () => {
  const { appDatabaseEncryptionKey } = useRuntimeConfig()

  if (!appDatabaseEncryptionKey.trim()) {
    throw new SavedSqlQueryEncryptionConfigurationError(
      'APP_DATABASE_ENCRYPTION_KEY is not configured.'
    )
  }

  return createHash('sha256')
    .update(ENCRYPTION_CONTEXT, 'utf8')
    .update('\u0000', 'utf8')
    .update(appDatabaseEncryptionKey, 'utf8')
    .digest()
}

const isSavedSqlQuerySecret = (
  value: unknown
): value is SavedSqlQuerySecret => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }

  const record = value as Record<string, unknown>

  return typeof record.sql === 'string'
}

/**
 * Encrypts the raw SQL text so it is never stored in plaintext.
 */
export const encryptSavedSqlQuerySecret = (
  payload: SavedSqlQuerySecret
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
 * Decrypts a stored SQL payload for explicit server-side query editing flows.
 */
export const decryptSavedSqlQuerySecret = (
  encryptedPayload: string
) => {
  const [version, initializationVector, authTag, ciphertext] = encryptedPayload.split('.')

  if (
    version !== ENCRYPTION_VERSION ||
    !initializationVector ||
    !authTag ||
    !ciphertext
  ) {
    throw new Error('Saved SQL query secret is invalid.')
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

  if (!isSavedSqlQuerySecret(parsedPayload)) {
    throw new Error('Saved SQL query secret is invalid.')
  }

  return parsedPayload
}

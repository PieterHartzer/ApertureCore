import { beforeEach, describe, expect, it, vi } from 'vitest'

const useRuntimeConfigMock = vi.fn()

vi.mock('#imports', () => ({
  useRuntimeConfig: useRuntimeConfigMock
}))

describe('database connection secret encryption', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useRuntimeConfigMock.mockReturnValue({
      appDatabaseEncryptionKey: 'test-encryption-key'
    })
  })

  it('round-trips an encrypted database connection secret', async () => {
    const {
      decryptSavedDatabaseConnectionSecret,
      encryptSavedDatabaseConnectionSecret
    } = await import('../../../server/utils/database-connection-secrets')

    const encrypted = encryptSavedDatabaseConnectionSecret({
      host: 'db.internal',
      port: 5432,
      databaseName: 'app_db',
      username: 'app_user',
      password: 'super-secret',
      sslMode: 'require'
    })

    expect(decryptSavedDatabaseConnectionSecret(encrypted)).toEqual({
      host: 'db.internal',
      port: 5432,
      databaseName: 'app_db',
      username: 'app_user',
      password: 'super-secret',
      sslMode: 'require'
    })
  })

  it('fails fast when the encryption key is missing', async () => {
    useRuntimeConfigMock.mockReturnValue({
      appDatabaseEncryptionKey: ''
    })

    const {
      encryptSavedDatabaseConnectionSecret
    } = await import('../../../server/utils/database-connection-secrets')

    expect(() => encryptSavedDatabaseConnectionSecret({
      host: 'db.internal',
      port: 5432,
      databaseName: 'app_db',
      username: 'app_user',
      password: 'super-secret',
      sslMode: 'disable'
    })).toThrowError('APP_DATABASE_ENCRYPTION_KEY is not configured.')
  })

  it('rejects malformed encrypted payloads', async () => {
    const {
      decryptSavedDatabaseConnectionSecret
    } = await import('../../../server/utils/database-connection-secrets')

    expect(() => decryptSavedDatabaseConnectionSecret('bad-payload')).toThrowError(
      'Saved database connection secret is invalid.'
    )
  })

  it('rejects decrypted payloads that do not match the saved connection shape', async () => {
    const {
      decryptSavedDatabaseConnectionSecret,
      encryptSavedDatabaseConnectionSecret
    } = await import('../../../server/utils/database-connection-secrets')

    const encrypted = encryptSavedDatabaseConnectionSecret([] as never)

    expect(() => decryptSavedDatabaseConnectionSecret(encrypted)).toThrowError(
      'Saved database connection secret is invalid.'
    )
  })
})

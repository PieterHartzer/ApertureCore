import { beforeEach, describe, expect, it, vi } from 'vitest'

const useRuntimeConfigMock = vi.fn()

vi.mock('#imports', () => ({
  useRuntimeConfig: useRuntimeConfigMock
}))

describe('saved SQL query secret encryption', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useRuntimeConfigMock.mockReturnValue({
      appDatabaseEncryptionKey: 'test-encryption-key'
    })
  })

  it('round-trips an encrypted SQL payload', async () => {
    const {
      decryptSavedSqlQuerySecret,
      encryptSavedSqlQuerySecret
    } = await import('../../../server/utils/saved-sql-query-secrets')

    const encrypted = encryptSavedSqlQuerySecret({
      sql: 'select * from accounts where active = true'
    })

    expect(decryptSavedSqlQuerySecret(encrypted)).toEqual({
      sql: 'select * from accounts where active = true'
    })
  })

  it('fails fast when the encryption key is missing', async () => {
    useRuntimeConfigMock.mockReturnValue({
      appDatabaseEncryptionKey: ''
    })

    const {
      encryptSavedSqlQuerySecret
    } = await import('../../../server/utils/saved-sql-query-secrets')

    expect(() => encryptSavedSqlQuerySecret({
      sql: 'select 1'
    })).toThrowError('APP_DATABASE_ENCRYPTION_KEY is not configured.')
  })

  it('rejects malformed encrypted payloads', async () => {
    const {
      decryptSavedSqlQuerySecret
    } = await import('../../../server/utils/saved-sql-query-secrets')

    expect(() => decryptSavedSqlQuerySecret('bad-payload')).toThrowError(
      'Saved SQL query secret is invalid.'
    )
  })

  it('rejects decrypted payloads that do not match the saved SQL query shape', async () => {
    const {
      decryptSavedSqlQuerySecret,
      encryptSavedSqlQuerySecret
    } = await import('../../../server/utils/saved-sql-query-secrets')

    const encrypted = encryptSavedSqlQuerySecret([] as never)

    expect(() => decryptSavedSqlQuerySecret(encrypted)).toThrowError(
      'Saved SQL query secret is invalid.'
    )
  })
})

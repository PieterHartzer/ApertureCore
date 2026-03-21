import { beforeEach, describe, expect, it, vi } from 'vitest'

const testConnectionMock = vi.fn()
const createDatabaseConnectionTesterMock = vi.fn(() => ({
  testConnection: testConnectionMock,
}))

vi.mock('../../../../server/services/database/factory', () => ({
  createDatabaseConnectionTester: createDatabaseConnectionTesterMock,
}))

describe('testDatabaseConnection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('delegates to the selected connection tester', async () => {
    const input = {
      connectionName: 'Primary',
      databaseType: 'postgresql' as const,
      host: 'db.internal',
      port: 5432,
      databaseName: 'app_db',
      username: 'admin',
      password: 'secret', // NOSONAR Dummy password
      sslMode: 'disable' as const,
    }
    const expected = {
      ok: true as const,
      code: 'success' as const,
      message: 'Connected',
    }

    testConnectionMock.mockResolvedValue(expected)

    const { testDatabaseConnection } = await import(
      '../../../../server/services/database/index'
    )

    await expect(testDatabaseConnection(input)).resolves.toEqual(expected)
    expect(createDatabaseConnectionTesterMock).toHaveBeenCalledWith('postgresql')
    expect(testConnectionMock).toHaveBeenCalledWith(input)
  })
})

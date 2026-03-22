import { beforeEach, describe, expect, it, vi } from 'vitest'

const testConnectionMock = vi.fn()
const executeReadOnlyQueryMock = vi.fn()
const createDatabaseConnectionTesterMock = vi.fn(() => ({
  testConnection: testConnectionMock,
}))
const createDatabaseQueryExecutorMock = vi.fn(() => ({
  executeReadOnlyQuery: executeReadOnlyQueryMock
}))

vi.mock('../../../../server/services/database/factory', () => ({
  createDatabaseConnectionTester: createDatabaseConnectionTesterMock,
  createDatabaseQueryExecutor: createDatabaseQueryExecutorMock,
}))

describe('database service facade', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('delegates connection tests to the selected connection tester', async () => {
    const input = {
      connectionName: 'Primary',
      databaseType: 'postgres' as const,
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
    expect(createDatabaseConnectionTesterMock).toHaveBeenCalledWith('postgres')
    expect(testConnectionMock).toHaveBeenCalledWith(input)
  })

  it('delegates read-only query tests to the selected query executor', async () => {
    const input = {
      databaseType: 'postgres' as const,
      host: 'db.internal',
      port: 5432,
      databaseName: 'app_db',
      username: 'admin',
      password: 'secret',
      sslMode: 'disable' as const,
      sql: 'select 1'
    }
    const expected = {
      ok: true as const,
      code: 'success' as const,
      message: 'success' as const,
      columns: ['?column?'],
      rows: [{ '?column?': 1 }],
      rowLimit: 25
    }

    executeReadOnlyQueryMock.mockResolvedValue(expected)

    const { testDatabaseReadOnlyQuery } = await import(
      '../../../../server/services/database/index'
    )

    await expect(testDatabaseReadOnlyQuery(input)).resolves.toEqual(expected)
    expect(createDatabaseQueryExecutorMock).toHaveBeenCalledWith('postgres')
    expect(executeReadOnlyQueryMock).toHaveBeenCalledWith(input)
  })

  it('maps unsupported database adapters to a stable query error code', async () => {
    createDatabaseQueryExecutorMock.mockImplementation(() => {
      throw new Error('unsupported_database_type:postgres')
    })

    const { testDatabaseReadOnlyQuery } = await import(
      '../../../../server/services/database/index'
    )

    await expect(testDatabaseReadOnlyQuery({
      databaseType: 'postgres',
      host: 'db.internal',
      port: 5432,
      databaseName: 'app_db',
      username: 'admin',
      password: 'secret',
      sslMode: 'disable',
      sql: 'select 1'
    })).resolves.toEqual({
      ok: false,
      code: 'unsupported_database_type',
      message: 'unsupported_database_type'
    })
  })

  it('rethrows unexpected query executor construction errors', async () => {
    createDatabaseQueryExecutorMock.mockImplementation(() => {
      throw new Error('boom')
    })

    const { testDatabaseReadOnlyQuery } = await import(
      '../../../../server/services/database/index'
    )

    await expect(testDatabaseReadOnlyQuery({
      databaseType: 'postgres',
      host: 'db.internal',
      port: 5432,
      databaseName: 'app_db',
      username: 'admin',
      password: 'secret',
      sslMode: 'disable',
      sql: 'select 1'
    })).rejects.toThrow('boom')
  })
})

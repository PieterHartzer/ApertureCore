import { beforeEach, describe, expect, it, vi } from 'vitest'

const useRuntimeConfigMock = vi.fn()
const getAppDatabaseMock = vi.fn()
const executeDatabaseReadOnlyQueryMock = vi.fn()
const decryptSavedDatabaseConnectionSecretMock = vi.fn()
const decryptSavedSqlQuerySecretMock = vi.fn()
const mapOrganizationIdToStorageMock = vi.fn()

class AppDatabaseConfigurationError extends Error {}
class DatabaseConnectionEncryptionConfigurationError extends Error {}
class SavedSqlQueryEncryptionConfigurationError extends Error {}

vi.mock('#imports', () => ({
  useRuntimeConfig: useRuntimeConfigMock
}))

vi.mock('../../../../server/utils/app-database', () => ({
  getAppDatabase: getAppDatabaseMock,
  AppDatabaseConfigurationError
}))

vi.mock('../../../../server/services/database', () => ({
  executeDatabaseReadOnlyQuery: executeDatabaseReadOnlyQueryMock
}))

vi.mock('../../../../server/utils/database-connection-secrets', () => ({
  decryptSavedDatabaseConnectionSecret: decryptSavedDatabaseConnectionSecretMock,
  DatabaseConnectionEncryptionConfigurationError
}))

vi.mock('../../../../server/utils/saved-sql-query-secrets', () => ({
  decryptSavedSqlQuerySecret: decryptSavedSqlQuerySecretMock,
  SavedSqlQueryEncryptionConfigurationError
}))

vi.mock('../../../../server/services/organization', () => ({
  mapOrganizationIdToStorage: mapOrganizationIdToStorageMock
}))

const authContext = {
  userId: 'user-1',
  organizationId: 'org-1',
  organizationName: 'ACME',
  organizationPrimaryDomain: 'acme.test'
}

const input = {
  connectionId: '2f8f9425-55cf-4d8e-a446-638848de1942',
  queryId: '7c6d9425-55cf-4d8e-a446-638848de1942'
}

const createExecutionLookupBuilder = (
  executionResource: Record<string, unknown> | undefined
) => {
  const joinBuilder = {
    onRef: vi.fn().mockReturnThis()
  }
  const selectBuilder = {
    innerJoin: vi.fn().mockImplementation((_table: string, callback: (join: typeof joinBuilder) => void) => {
      callback(joinBuilder)
      return selectBuilder
    }),
    select: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    executeTakeFirst: vi.fn().mockResolvedValue(executionResource)
  }

  return {
    joinBuilder,
    selectBuilder
  }
}

describe('executeQuery utility', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    useRuntimeConfigMock.mockReturnValue({
      maxQueryRows: 500,
      queryTimeoutMs: 15_000
    })
    mapOrganizationIdToStorageMock.mockReturnValue('org-storage-1')
    decryptSavedSqlQuerySecretMock.mockReturnValue({
      sql: 'select id, total from invoices order by total desc'
    })
    decryptSavedDatabaseConnectionSecretMock.mockReturnValue({
      host: 'db.internal',
      port: 5432,
      databaseName: 'warehouse',
      username: 'dashboard',
      password: 'secret',
      sslMode: 'require'
    })
  })

  it('executes the saved query only through its persisted saved connection', async () => {
    const { joinBuilder, selectBuilder } = createExecutionLookupBuilder({
      encrypted_sql: 'encrypted-sql',
      database_type: 'postgres',
      encrypted_secret: 'encrypted-secret'
    })
    const mockDb = {
      selectFrom: vi.fn().mockReturnValue(selectBuilder)
    }
    getAppDatabaseMock.mockReturnValue(mockDb)
    executeDatabaseReadOnlyQueryMock.mockResolvedValue({
      ok: true,
      code: 'success',
      message: 'success',
      columns: ['id', 'total'],
      rows: [{
        id: 1,
        total: 250
      }],
      rowLimit: 500
    })

    const { executeQuery } = await import(
      '../../../../server/utils/database/executeQuery'
    )

    await expect(executeQuery(authContext, input)).resolves.toEqual({
      ok: true,
      code: 'success',
      columns: ['id', 'total'],
      rows: [{
        id: 1,
        total: 250
      }],
      rowLimit: 500
    })
    expect(mockDb.selectFrom).toHaveBeenCalledWith(
      'app_saved_sql_queries as query'
    )
    expect(selectBuilder.innerJoin).toHaveBeenCalledWith(
      'app_database_connections as connection',
      expect.any(Function)
    )
    expect(joinBuilder.onRef).toHaveBeenNthCalledWith(
      1,
      'connection.organization_id',
      '=',
      'query.organization_id'
    )
    expect(joinBuilder.onRef).toHaveBeenNthCalledWith(
      2,
      'connection.connection_id',
      '=',
      'query.connection_id'
    )
    expect(selectBuilder.where).toHaveBeenNthCalledWith(
      1,
      'query.organization_id',
      '=',
      'org-storage-1'
    )
    expect(selectBuilder.where).toHaveBeenNthCalledWith(
      2,
      'query.query_id',
      '=',
      input.queryId
    )
    expect(selectBuilder.where).toHaveBeenNthCalledWith(
      3,
      'query.connection_id',
      '=',
      input.connectionId
    )
    expect(executeDatabaseReadOnlyQueryMock).toHaveBeenCalledWith({
      databaseType: 'postgres',
      host: 'db.internal',
      port: 5432,
      databaseName: 'warehouse',
      username: 'dashboard',
      password: 'secret',
      sslMode: 'require',
      sql: 'select id, total from invoices order by total desc',
      maxRows: 500,
      timeoutMs: 15_000
    })
  })

  it('parses numeric-string runtime limits before delegating to the database adapter', async () => {
    useRuntimeConfigMock.mockReturnValue({
      maxQueryRows: '750',
      queryTimeoutMs: '20000'
    })
    const { selectBuilder } = createExecutionLookupBuilder({
      encrypted_sql: 'encrypted-sql',
      database_type: 'postgres',
      encrypted_secret: 'encrypted-secret'
    })
    getAppDatabaseMock.mockReturnValue({
      selectFrom: vi.fn().mockReturnValue(selectBuilder)
    })
    executeDatabaseReadOnlyQueryMock.mockResolvedValue({
      ok: true,
      code: 'success',
      message: 'success',
      columns: ['id'],
      rows: [{ id: 1 }],
      rowLimit: 750
    })

    const { executeQuery } = await import(
      '../../../../server/utils/database/executeQuery'
    )

    await executeQuery(authContext, input)

    expect(executeDatabaseReadOnlyQueryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        maxRows: 750,
        timeoutMs: 20_000
      })
    )
  })

  it('returns forbidden when the saved query is missing or bound to a different connection', async () => {
    const { selectBuilder } = createExecutionLookupBuilder(undefined)
    getAppDatabaseMock.mockReturnValue({
      selectFrom: vi.fn().mockReturnValue(selectBuilder)
    })

    const { executeQuery } = await import(
      '../../../../server/utils/database/executeQuery'
    )

    await expect(executeQuery(authContext, input)).resolves.toEqual({
      ok: false,
      code: 'forbidden',
      message: 'forbidden'
    })
    expect(executeDatabaseReadOnlyQueryMock).not.toHaveBeenCalled()
  })

  it('maps persistence configuration failures to persistence_unavailable', async () => {
    getAppDatabaseMock.mockImplementation(() => {
      throw new AppDatabaseConfigurationError('missing db')
    })

    const { executeQuery } = await import(
      '../../../../server/utils/database/executeQuery'
    )

    await expect(executeQuery(authContext, input)).resolves.toEqual({
      ok: false,
      code: 'persistence_unavailable',
      message: 'persistence_unavailable'
    })
  })

  it('passes adapter failures through with stable error codes', async () => {
    const { selectBuilder } = createExecutionLookupBuilder({
      encrypted_sql: 'encrypted-sql',
      database_type: 'postgres',
      encrypted_secret: 'encrypted-secret'
    })
    getAppDatabaseMock.mockReturnValue({
      selectFrom: vi.fn().mockReturnValue(selectBuilder)
    })
    executeDatabaseReadOnlyQueryMock.mockResolvedValue({
      ok: false,
      code: 'timeout',
      message: 'timeout',
      details: 'statement timeout'
    })

    const { executeQuery } = await import(
      '../../../../server/utils/database/executeQuery'
    )

    await expect(executeQuery(authContext, input)).resolves.toEqual({
      ok: false,
      code: 'timeout',
      message: 'timeout',
      details: 'statement timeout'
    })
  })

  it('returns unexpected_error when execution lookup throws unexpectedly', async () => {
    const { selectBuilder } = createExecutionLookupBuilder({
      encrypted_sql: 'encrypted-sql',
      database_type: 'postgres',
      encrypted_secret: 'encrypted-secret'
    })
    selectBuilder.executeTakeFirst.mockRejectedValue(new Error('boom'))
    getAppDatabaseMock.mockReturnValue({
      selectFrom: vi.fn().mockReturnValue(selectBuilder)
    })
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { executeQuery } = await import(
      '../../../../server/utils/database/executeQuery'
    )

    await expect(executeQuery(authContext, input)).resolves.toEqual({
      ok: false,
      code: 'unexpected_error',
      message: 'unexpected_error'
    })
    expect(consoleErrorSpy).toHaveBeenCalled()

    consoleErrorSpy.mockRestore()
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { isUuid } from '../../../server/utils/is-uuid'

const getAppDatabaseMock = vi.fn()
const encryptSavedSqlQuerySecretMock = vi.fn()
const decryptSavedSqlQuerySecretMock = vi.fn()
const decryptSavedDatabaseConnectionSecretMock = vi.fn()
const testDatabaseReadOnlyQueryMock = vi.fn()

class AppDatabaseConfigurationError extends Error {}
class DatabaseConnectionEncryptionConfigurationError extends Error {}
class SavedSqlQueryEncryptionConfigurationError extends Error {}

vi.mock('../../../server/utils/app-database', () => ({
  getAppDatabase: getAppDatabaseMock,
  AppDatabaseConfigurationError
}))

vi.mock('../../../server/services/database', () => ({
  testDatabaseReadOnlyQuery: testDatabaseReadOnlyQueryMock
}))

vi.mock('../../../server/utils/database-connection-secrets', () => ({
  decryptSavedDatabaseConnectionSecret: decryptSavedDatabaseConnectionSecretMock,
  DatabaseConnectionEncryptionConfigurationError
}))

vi.mock('../../../server/utils/saved-sql-query-secrets', () => ({
  decryptSavedSqlQuerySecret: decryptSavedSqlQuerySecretMock,
  encryptSavedSqlQuerySecret: encryptSavedSqlQuerySecretMock,
  SavedSqlQueryEncryptionConfigurationError
}))

const authContext = {
  userId: 'user-1',
  organizationId: 'org-1',
  organizationName: 'ACME',
  organizationPrimaryDomain: 'acme.test'
}

const queryInput = {
  queryName: 'Top customers',
  connectionId: 'connection-1',
  sql: 'select * from customers order by total_spend desc'
}

describe('saved SQL query persistence service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    encryptSavedSqlQuerySecretMock.mockReturnValue('encrypted-sql')
    decryptSavedSqlQuerySecretMock.mockReturnValue({
      sql: queryInput.sql
    })
    decryptSavedDatabaseConnectionSecretMock.mockReturnValue({
      host: 'db.internal',
      port: 5432,
      databaseName: 'app_db',
      username: 'admin',
      password: 'secret',
      sslMode: 'disable'
    })
  })

  it('maps persistence configuration failures cleanly when listing queries', async () => {
    getAppDatabaseMock.mockImplementation(() => {
      throw new AppDatabaseConfigurationError('missing db')
    })

    const { listSavedSqlQueries } = await import(
      '../../../server/services/saved-sql-queries'
    )

    await expect(listSavedSqlQueries(authContext)).resolves.toEqual({
      ok: false,
      code: 'persistence_unavailable',
      message: 'persistence_unavailable'
    })
  })

  it('lists saved query summaries without exposing encrypted SQL', async () => {
    const joinBuilder = {
      onRef: vi.fn().mockReturnThis()
    }
    const selectBuilder = {
      innerJoin: vi.fn().mockImplementation((_table, callback) => {
        callback(joinBuilder)
        return selectBuilder
      }),
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue([{
        query_id: 'query-1',
        query_name: 'Top customers',
        connection_id: 'connection-1',
        connection_name: 'Primary DB',
        created_at: new Date('2026-03-19T00:00:00.000Z'),
        updated_at: new Date('2026-03-20T00:00:00.000Z')
      }])
    }
    const mockDb = {
      selectFrom: vi.fn().mockReturnValue(selectBuilder)
    }
    getAppDatabaseMock.mockReturnValue(mockDb)

    const { listSavedSqlQueries } = await import(
      '../../../server/services/saved-sql-queries'
    )

    await expect(listSavedSqlQueries(authContext)).resolves.toEqual({
      ok: true,
      code: 'success',
      queries: [{
        id: 'query-1',
        queryName: 'Top customers',
        connectionId: 'connection-1',
        connectionName: 'Primary DB',
        createdAt: '2026-03-19T00:00:00.000Z',
        updatedAt: '2026-03-20T00:00:00.000Z'
      }]
    })
    expect(mockDb.selectFrom).toHaveBeenCalledWith('app_saved_sql_queries as query')
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
    expect(selectBuilder.select).toHaveBeenCalledWith([
      'query.query_id as query_id',
      'query.query_name as query_name',
      'query.connection_id as connection_id',
      'connection.connection_name as connection_name',
      'query.created_at as created_at',
      'query.updated_at as updated_at'
    ])
    expect(selectBuilder.select.mock.calls[0][0]).not.toContain('query.encrypted_sql')
  })

  it('returns unexpected_error when list queries fails unexpectedly', async () => {
    const mockDb = {
      selectFrom: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        execute: vi.fn().mockRejectedValue(new Error('boom'))
      })
    }
    getAppDatabaseMock.mockReturnValue(mockDb)
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { listSavedSqlQueries } = await import(
      '../../../server/services/saved-sql-queries'
    )

    await expect(listSavedSqlQueries(authContext)).resolves.toEqual({
      ok: false,
      code: 'unexpected_error',
      message: 'unexpected_error'
    })
    expect(consoleErrorSpy).toHaveBeenCalled()

    consoleErrorSpy.mockRestore()
  })

  it('saves a query scoped to the current organization', async () => {
    const organizationInsertBuilder = {
      values: vi.fn().mockReturnThis(),
      onConflict: vi.fn().mockReturnThis(),
      column: vi.fn().mockReturnThis(),
      doUpdateSet: vi.fn().mockReturnThis(),
      executeTakeFirst: vi.fn().mockResolvedValue(undefined)
    }
    const connectionSelectBuilder = {
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      executeTakeFirst: vi.fn().mockResolvedValue({
        connection_id: queryInput.connectionId,
        connection_name: 'Primary DB'
      })
    }
    const queryInsertBuilder = {
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockReturnThis(),
      executeTakeFirst: vi.fn().mockResolvedValue({
        query_id: 'query-1',
        query_name: queryInput.queryName,
        connection_id: queryInput.connectionId,
        created_at: new Date('2026-03-22T00:00:00.000Z'),
        updated_at: new Date('2026-03-22T00:00:00.000Z')
      })
    }
    const mockDb = {
      insertInto: vi.fn().mockImplementation((table: string) => {
        return table === 'app_organizations'
          ? organizationInsertBuilder
          : queryInsertBuilder
      }),
      selectFrom: vi.fn().mockImplementation((table: string) => {
        return table === 'app_database_connections'
          ? connectionSelectBuilder
          : undefined
      })
    }
    getAppDatabaseMock.mockReturnValue(mockDb)

    const { saveSavedSqlQuery } = await import(
      '../../../server/services/saved-sql-queries'
    )

    await expect(saveSavedSqlQuery(authContext, queryInput)).resolves.toEqual({
      ok: true,
      code: 'success',
      query: {
        id: 'query-1',
        queryName: 'Top customers',
        connectionId: 'connection-1',
        connectionName: 'Primary DB',
        createdAt: '2026-03-22T00:00:00.000Z',
        updatedAt: '2026-03-22T00:00:00.000Z'
      }
    })
    expect(encryptSavedSqlQuerySecretMock).toHaveBeenCalledWith({
      sql: queryInput.sql
    })
    expect(organizationInsertBuilder.values).toHaveBeenCalledWith(
      expect.objectContaining({
        organization_id: expect.any(String),
        organization_name: authContext.organizationName,
        organization_primary_domain: authContext.organizationPrimaryDomain
      })
    )
    expect(
      isUuid(organizationInsertBuilder.values.mock.calls[0][0].organization_id)
    ).toBe(true)
    expect(queryInsertBuilder.values).toHaveBeenCalledWith(
      expect.objectContaining({
        organization_id: expect.any(String),
        connection_id: queryInput.connectionId,
        query_name: queryInput.queryName,
        encrypted_sql: 'encrypted-sql',
        created_by_user_id: authContext.userId,
        updated_by_user_id: authContext.userId
      })
    )
    expect(
      isUuid(queryInsertBuilder.values.mock.calls[0][0].organization_id)
    ).toBe(true)
  })

  it('returns not_found when the selected connection does not exist', async () => {
    const organizationInsertBuilder = {
      values: vi.fn().mockReturnThis(),
      onConflict: vi.fn().mockReturnThis(),
      column: vi.fn().mockReturnThis(),
      doUpdateSet: vi.fn().mockReturnThis(),
      executeTakeFirst: vi.fn().mockResolvedValue(undefined)
    }
    const connectionSelectBuilder = {
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      executeTakeFirst: vi.fn().mockResolvedValue(undefined)
    }
    const mockDb = {
      insertInto: vi.fn().mockReturnValue(organizationInsertBuilder),
      selectFrom: vi.fn().mockReturnValue(connectionSelectBuilder)
    }
    getAppDatabaseMock.mockReturnValue(mockDb)

    const { saveSavedSqlQuery } = await import(
      '../../../server/services/saved-sql-queries'
    )

    await expect(saveSavedSqlQuery(authContext, queryInput)).resolves.toEqual({
      ok: false,
      code: 'not_found',
      message: 'not_found'
    })
  })

  it('maps duplicate query names to a stable error code', async () => {
    const organizationInsertBuilder = {
      values: vi.fn().mockReturnThis(),
      onConflict: vi.fn().mockReturnThis(),
      column: vi.fn().mockReturnThis(),
      doUpdateSet: vi.fn().mockReturnThis(),
      executeTakeFirst: vi.fn().mockResolvedValue(undefined)
    }
    const connectionSelectBuilder = {
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      executeTakeFirst: vi.fn().mockResolvedValue({
        connection_id: queryInput.connectionId,
        connection_name: 'Primary DB'
      })
    }
    const queryInsertBuilder = {
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockReturnThis(),
      executeTakeFirst: vi.fn().mockRejectedValue({
        code: '23505',
        constraint: 'app_saved_sql_queries_unique_name_per_connection'
      })
    }
    const mockDb = {
      insertInto: vi.fn().mockImplementation((table: string) => {
        return table === 'app_organizations'
          ? organizationInsertBuilder
          : queryInsertBuilder
      }),
      selectFrom: vi.fn().mockReturnValue(connectionSelectBuilder)
    }
    getAppDatabaseMock.mockReturnValue(mockDb)

    const { saveSavedSqlQuery } = await import(
      '../../../server/services/saved-sql-queries'
    )

    await expect(saveSavedSqlQuery(authContext, queryInput)).resolves.toEqual({
      ok: false,
      code: 'duplicate_query_name',
      message: 'duplicate_query_name'
    })
  })

  it('maps missing connections reported by the foreign key to not_found', async () => {
    const organizationInsertBuilder = {
      values: vi.fn().mockReturnThis(),
      onConflict: vi.fn().mockReturnThis(),
      column: vi.fn().mockReturnThis(),
      doUpdateSet: vi.fn().mockReturnThis(),
      executeTakeFirst: vi.fn().mockResolvedValue(undefined)
    }
    const connectionSelectBuilder = {
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      executeTakeFirst: vi.fn().mockResolvedValue({
        connection_id: queryInput.connectionId,
        connection_name: 'Primary DB'
      })
    }
    const queryInsertBuilder = {
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockReturnThis(),
      executeTakeFirst: vi.fn().mockRejectedValue({
        code: '23503',
        constraint: 'app_saved_sql_queries_organization_connection_fkey'
      })
    }
    const mockDb = {
      insertInto: vi.fn().mockImplementation((table: string) => {
        return table === 'app_organizations'
          ? organizationInsertBuilder
          : queryInsertBuilder
      }),
      selectFrom: vi.fn().mockReturnValue(connectionSelectBuilder)
    }
    getAppDatabaseMock.mockReturnValue(mockDb)

    const { saveSavedSqlQuery } = await import(
      '../../../server/services/saved-sql-queries'
    )

    await expect(saveSavedSqlQuery(authContext, queryInput)).resolves.toEqual({
      ok: false,
      code: 'not_found',
      message: 'not_found'
    })
  })

  it('maps encryption configuration failures cleanly when saving queries', async () => {
    encryptSavedSqlQuerySecretMock.mockImplementation(() => {
      throw new SavedSqlQueryEncryptionConfigurationError('missing key')
    })
    const organizationInsertBuilder = {
      values: vi.fn().mockReturnThis(),
      onConflict: vi.fn().mockReturnThis(),
      column: vi.fn().mockReturnThis(),
      doUpdateSet: vi.fn().mockReturnThis(),
      executeTakeFirst: vi.fn().mockResolvedValue(undefined)
    }
    const connectionSelectBuilder = {
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      executeTakeFirst: vi.fn().mockResolvedValue({
        connection_id: queryInput.connectionId,
        connection_name: 'Primary DB'
      })
    }
    const mockDb = {
      insertInto: vi.fn().mockReturnValue(organizationInsertBuilder),
      selectFrom: vi.fn().mockReturnValue(connectionSelectBuilder)
    }
    getAppDatabaseMock.mockReturnValue(mockDb)

    const { saveSavedSqlQuery } = await import(
      '../../../server/services/saved-sql-queries'
    )

    await expect(saveSavedSqlQuery(authContext, queryInput)).resolves.toEqual({
      ok: false,
      code: 'persistence_unavailable',
      message: 'persistence_unavailable'
    })
  })

  it('returns unexpected_error when saving fails unexpectedly', async () => {
    const organizationInsertBuilder = {
      values: vi.fn().mockReturnThis(),
      onConflict: vi.fn().mockReturnThis(),
      column: vi.fn().mockReturnThis(),
      doUpdateSet: vi.fn().mockReturnThis(),
      executeTakeFirst: vi.fn().mockResolvedValue(undefined)
    }
    const connectionSelectBuilder = {
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      executeTakeFirst: vi.fn().mockResolvedValue({
        connection_id: queryInput.connectionId,
        connection_name: 'Primary DB'
      })
    }
    const queryInsertBuilder = {
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockReturnThis(),
      executeTakeFirst: vi.fn().mockRejectedValue(new Error('boom'))
    }
    const mockDb = {
      insertInto: vi.fn().mockImplementation((table: string) => {
        return table === 'app_organizations'
          ? organizationInsertBuilder
          : queryInsertBuilder
      }),
      selectFrom: vi.fn().mockReturnValue(connectionSelectBuilder)
    }
    getAppDatabaseMock.mockReturnValue(mockDb)
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { saveSavedSqlQuery } = await import(
      '../../../server/services/saved-sql-queries'
    )

    await expect(saveSavedSqlQuery(authContext, queryInput)).resolves.toEqual({
      ok: false,
      code: 'unexpected_error',
      message: 'unexpected_error'
    })
    expect(consoleErrorSpy).toHaveBeenCalled()

    consoleErrorSpy.mockRestore()
  })

  it('returns unexpected_error when saving returns no inserted row', async () => {
    const organizationInsertBuilder = {
      values: vi.fn().mockReturnThis(),
      onConflict: vi.fn().mockReturnThis(),
      column: vi.fn().mockReturnThis(),
      doUpdateSet: vi.fn().mockReturnThis(),
      executeTakeFirst: vi.fn().mockResolvedValue(undefined)
    }
    const connectionSelectBuilder = {
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      executeTakeFirst: vi.fn().mockResolvedValue({
        connection_id: queryInput.connectionId,
        connection_name: 'Primary DB'
      })
    }
    const queryInsertBuilder = {
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockReturnThis(),
      executeTakeFirst: vi.fn().mockResolvedValue(undefined)
    }
    const mockDb = {
      insertInto: vi.fn().mockImplementation((table: string) => {
        return table === 'app_organizations'
          ? organizationInsertBuilder
          : queryInsertBuilder
      }),
      selectFrom: vi.fn().mockReturnValue(connectionSelectBuilder)
    }
    getAppDatabaseMock.mockReturnValue(mockDb)

    const { saveSavedSqlQuery } = await import(
      '../../../server/services/saved-sql-queries'
    )

    await expect(saveSavedSqlQuery(authContext, queryInput)).resolves.toEqual({
      ok: false,
      code: 'unexpected_error',
      message: 'unexpected_error'
    })
  })

  it('returns a decrypted saved query only for the explicit edit read path', async () => {
    const querySelectBuilder = {
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      executeTakeFirst: vi.fn().mockResolvedValue({
        query_id: 'query-1',
        query_name: queryInput.queryName,
        connection_id: queryInput.connectionId,
        encrypted_sql: 'encrypted-sql',
        created_at: new Date('2026-03-22T00:00:00.000Z'),
        updated_at: new Date('2026-03-22T01:00:00.000Z')
      })
    }
    const mockDb = {
      selectFrom: vi.fn().mockReturnValue(querySelectBuilder)
    }
    getAppDatabaseMock.mockReturnValue(mockDb)

    const { getSavedSqlQuery } = await import(
      '../../../server/services/saved-sql-queries'
    )

    await expect(
      getSavedSqlQuery(authContext, 'query-1')
    ).resolves.toEqual({
      ok: true,
      code: 'success',
      query: {
        id: 'query-1',
        queryName: queryInput.queryName,
        connectionId: queryInput.connectionId,
        sql: queryInput.sql,
        createdAt: '2026-03-22T00:00:00.000Z',
        updatedAt: '2026-03-22T01:00:00.000Z'
      }
    })
    expect(decryptSavedSqlQuerySecretMock).toHaveBeenCalledWith('encrypted-sql')
  })

  it('returns not_found when an editable saved query does not exist', async () => {
    const querySelectBuilder = {
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      executeTakeFirst: vi.fn().mockResolvedValue(undefined)
    }
    const mockDb = {
      selectFrom: vi.fn().mockReturnValue(querySelectBuilder)
    }
    getAppDatabaseMock.mockReturnValue(mockDb)

    const { getSavedSqlQuery } = await import(
      '../../../server/services/saved-sql-queries'
    )

    await expect(
      getSavedSqlQuery(authContext, 'missing-query')
    ).resolves.toEqual({
      ok: false,
      code: 'not_found',
      message: 'not_found'
    })
  })

  it('maps persistence configuration failures cleanly when loading a saved query', async () => {
    getAppDatabaseMock.mockImplementation(() => {
      throw new AppDatabaseConfigurationError('missing db')
    })

    const { getSavedSqlQuery } = await import(
      '../../../server/services/saved-sql-queries'
    )

    await expect(
      getSavedSqlQuery(authContext, 'query-1')
    ).resolves.toEqual({
      ok: false,
      code: 'persistence_unavailable',
      message: 'persistence_unavailable'
    })
  })

  it('returns unexpected_error when loading a saved query fails unexpectedly', async () => {
    const querySelectBuilder = {
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      executeTakeFirst: vi.fn().mockRejectedValue(new Error('boom'))
    }
    const mockDb = {
      selectFrom: vi.fn().mockReturnValue(querySelectBuilder)
    }
    getAppDatabaseMock.mockReturnValue(mockDb)
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { getSavedSqlQuery } = await import(
      '../../../server/services/saved-sql-queries'
    )

    await expect(
      getSavedSqlQuery(authContext, 'query-1')
    ).resolves.toEqual({
      ok: false,
      code: 'unexpected_error',
      message: 'unexpected_error'
    })
    expect(consoleErrorSpy).toHaveBeenCalled()

    consoleErrorSpy.mockRestore()
  })

  it('updates a saved query and re-encrypts the SQL payload', async () => {
    const querySelectBuilder = {
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      executeTakeFirst: vi.fn()
        .mockResolvedValueOnce({
          query_id: 'query-1'
        })
        .mockResolvedValueOnce({
          connection_id: queryInput.connectionId,
          connection_name: 'Primary DB'
        })
    }
    const queryUpdateBuilder = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      returning: vi.fn().mockReturnThis(),
      executeTakeFirst: vi.fn().mockResolvedValue({
        query_id: 'query-1',
        query_name: 'Top customers by spend',
        connection_id: queryInput.connectionId,
        created_at: new Date('2026-03-22T00:00:00.000Z'),
        updated_at: new Date('2026-03-22T02:00:00.000Z')
      })
    }
    const mockDb = {
      selectFrom: vi.fn().mockReturnValue(querySelectBuilder),
      updateTable: vi.fn().mockReturnValue(queryUpdateBuilder)
    }
    getAppDatabaseMock.mockReturnValue(mockDb)

    const { updateSavedSqlQuery } = await import(
      '../../../server/services/saved-sql-queries'
    )

    await expect(updateSavedSqlQuery(authContext, {
      queryId: 'query-1',
      queryName: 'Top customers by spend',
      connectionId: queryInput.connectionId,
      sql: 'select id from customers order by total_spend desc'
    })).resolves.toEqual({
      ok: true,
      code: 'success',
      query: {
        id: 'query-1',
        queryName: 'Top customers by spend',
        connectionId: queryInput.connectionId,
        connectionName: 'Primary DB',
        createdAt: '2026-03-22T00:00:00.000Z',
        updatedAt: '2026-03-22T02:00:00.000Z'
      }
    })
    expect(encryptSavedSqlQuerySecretMock).toHaveBeenCalledWith({
      sql: 'select id from customers order by total_spend desc'
    })
    expect(queryUpdateBuilder.set).toHaveBeenCalledWith({
      connection_id: queryInput.connectionId,
      query_name: 'Top customers by spend',
      encrypted_sql: 'encrypted-sql',
      updated_by_user_id: authContext.userId
    })
  })

  it('returns not_found when updating a missing saved query', async () => {
    const querySelectBuilder = {
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      executeTakeFirst: vi.fn().mockResolvedValue(undefined)
    }
    const mockDb = {
      selectFrom: vi.fn().mockReturnValue(querySelectBuilder)
    }
    getAppDatabaseMock.mockReturnValue(mockDb)

    const { updateSavedSqlQuery } = await import(
      '../../../server/services/saved-sql-queries'
    )

    await expect(updateSavedSqlQuery(authContext, {
      queryId: 'missing-query',
      ...queryInput
    })).resolves.toEqual({
      ok: false,
      code: 'not_found',
      message: 'not_found'
    })
  })

  it('returns not_found when updating to a missing saved connection', async () => {
    const querySelectBuilder = {
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      executeTakeFirst: vi.fn()
        .mockResolvedValueOnce({
          query_id: 'query-1'
        })
        .mockResolvedValueOnce(undefined)
    }
    const mockDb = {
      selectFrom: vi.fn().mockReturnValue(querySelectBuilder)
    }
    getAppDatabaseMock.mockReturnValue(mockDb)

    const { updateSavedSqlQuery } = await import(
      '../../../server/services/saved-sql-queries'
    )

    await expect(updateSavedSqlQuery(authContext, {
      queryId: 'query-1',
      ...queryInput
    })).resolves.toEqual({
      ok: false,
      code: 'not_found',
      message: 'not_found'
    })
  })

  it('returns duplicate_query_name when updating conflicts on the unique query name constraint', async () => {
    const querySelectBuilder = {
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      executeTakeFirst: vi.fn()
        .mockResolvedValueOnce({
          query_id: 'query-1'
        })
        .mockResolvedValueOnce({
          connection_id: queryInput.connectionId,
          connection_name: 'Primary DB'
        })
    }
    const queryUpdateBuilder = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      returning: vi.fn().mockReturnThis(),
      executeTakeFirst: vi.fn().mockRejectedValue({
        code: '23505',
        constraint: 'app_saved_sql_queries_unique_name_per_connection'
      })
    }
    const mockDb = {
      selectFrom: vi.fn().mockReturnValue(querySelectBuilder),
      updateTable: vi.fn().mockReturnValue(queryUpdateBuilder)
    }
    getAppDatabaseMock.mockReturnValue(mockDb)

    const { updateSavedSqlQuery } = await import(
      '../../../server/services/saved-sql-queries'
    )

    await expect(updateSavedSqlQuery(authContext, {
      queryId: 'query-1',
      ...queryInput
    })).resolves.toEqual({
      ok: false,
      code: 'duplicate_query_name',
      message: 'duplicate_query_name'
    })
  })

  it('maps missing connections reported by the update foreign key to not_found', async () => {
    const querySelectBuilder = {
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      executeTakeFirst: vi.fn()
        .mockResolvedValueOnce({
          query_id: 'query-1'
        })
        .mockResolvedValueOnce({
          connection_id: queryInput.connectionId,
          connection_name: 'Primary DB'
        })
    }
    const queryUpdateBuilder = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      returning: vi.fn().mockReturnThis(),
      executeTakeFirst: vi.fn().mockRejectedValue({
        code: '23503',
        constraint: 'app_saved_sql_queries_organization_connection_fkey'
      })
    }
    const mockDb = {
      selectFrom: vi.fn().mockReturnValue(querySelectBuilder),
      updateTable: vi.fn().mockReturnValue(queryUpdateBuilder)
    }
    getAppDatabaseMock.mockReturnValue(mockDb)

    const { updateSavedSqlQuery } = await import(
      '../../../server/services/saved-sql-queries'
    )

    await expect(updateSavedSqlQuery(authContext, {
      queryId: 'query-1',
      ...queryInput
    })).resolves.toEqual({
      ok: false,
      code: 'not_found',
      message: 'not_found'
    })
  })

  it('returns not_found when an update no longer returns a row', async () => {
    const querySelectBuilder = {
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      executeTakeFirst: vi.fn()
        .mockResolvedValueOnce({
          query_id: 'query-1'
        })
        .mockResolvedValueOnce({
          connection_id: queryInput.connectionId,
          connection_name: 'Primary DB'
        })
    }
    const queryUpdateBuilder = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      returning: vi.fn().mockReturnThis(),
      executeTakeFirst: vi.fn().mockResolvedValue(undefined)
    }
    const mockDb = {
      selectFrom: vi.fn().mockReturnValue(querySelectBuilder),
      updateTable: vi.fn().mockReturnValue(queryUpdateBuilder)
    }
    getAppDatabaseMock.mockReturnValue(mockDb)

    const { updateSavedSqlQuery } = await import(
      '../../../server/services/saved-sql-queries'
    )

    await expect(updateSavedSqlQuery(authContext, {
      queryId: 'query-1',
      ...queryInput
    })).resolves.toEqual({
      ok: false,
      code: 'not_found',
      message: 'not_found'
    })
  })

  it('maps persistence configuration failures cleanly when updating queries', async () => {
    getAppDatabaseMock.mockImplementation(() => {
      throw new AppDatabaseConfigurationError('missing db')
    })

    const { updateSavedSqlQuery } = await import(
      '../../../server/services/saved-sql-queries'
    )

    await expect(updateSavedSqlQuery(authContext, {
      queryId: 'query-1',
      ...queryInput
    })).resolves.toEqual({
      ok: false,
      code: 'persistence_unavailable',
      message: 'persistence_unavailable'
    })
  })

  it('returns unexpected_error when updating a query fails unexpectedly', async () => {
    const querySelectBuilder = {
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      executeTakeFirst: vi.fn().mockRejectedValue(new Error('boom'))
    }
    const mockDb = {
      selectFrom: vi.fn().mockReturnValue(querySelectBuilder)
    }
    getAppDatabaseMock.mockReturnValue(mockDb)
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { updateSavedSqlQuery } = await import(
      '../../../server/services/saved-sql-queries'
    )

    await expect(updateSavedSqlQuery(authContext, {
      queryId: 'query-1',
      ...queryInput
    })).resolves.toEqual({
      ok: false,
      code: 'unexpected_error',
      message: 'unexpected_error'
    })
    expect(consoleErrorSpy).toHaveBeenCalled()

    consoleErrorSpy.mockRestore()
  })

  it('soft deletes a saved query after the name is confirmed', async () => {
    const querySelectBuilder = {
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      executeTakeFirst: vi.fn().mockResolvedValue({
        query_id: 'query-1',
        query_name: queryInput.queryName
      })
    }
    const queryDeleteBuilder = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      executeTakeFirst: vi.fn().mockResolvedValue(undefined)
    }
    const mockDb = {
      selectFrom: vi.fn().mockReturnValue(querySelectBuilder),
      updateTable: vi.fn().mockReturnValue(queryDeleteBuilder)
    }
    getAppDatabaseMock.mockReturnValue(mockDb)

    const { deleteSavedSqlQuery } = await import(
      '../../../server/services/saved-sql-queries'
    )

    await expect(deleteSavedSqlQuery(authContext, {
      queryId: 'query-1',
      confirmationName: queryInput.queryName
    })).resolves.toEqual({
      ok: true,
      code: 'success'
    })
    expect(queryDeleteBuilder.set).toHaveBeenCalledWith({
      deleted_at: expect.any(Date),
      updated_by_user_id: authContext.userId
    })
  })

  it('returns confirmation_mismatch when deleting with the wrong query name', async () => {
    const querySelectBuilder = {
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      executeTakeFirst: vi.fn().mockResolvedValue({
        query_id: 'query-1',
        query_name: queryInput.queryName
      })
    }
    const mockDb = {
      selectFrom: vi.fn().mockReturnValue(querySelectBuilder)
    }
    getAppDatabaseMock.mockReturnValue(mockDb)

    const { deleteSavedSqlQuery } = await import(
      '../../../server/services/saved-sql-queries'
    )

    await expect(deleteSavedSqlQuery(authContext, {
      queryId: 'query-1',
      confirmationName: 'Wrong name'
    })).resolves.toEqual({
      ok: false,
      code: 'confirmation_mismatch',
      message: 'confirmation_mismatch'
    })
  })

  it('returns not_found when deleting a missing saved query', async () => {
    const querySelectBuilder = {
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      executeTakeFirst: vi.fn().mockResolvedValue(undefined)
    }
    const mockDb = {
      selectFrom: vi.fn().mockReturnValue(querySelectBuilder)
    }
    getAppDatabaseMock.mockReturnValue(mockDb)

    const { deleteSavedSqlQuery } = await import(
      '../../../server/services/saved-sql-queries'
    )

    await expect(deleteSavedSqlQuery(authContext, {
      queryId: 'missing-query',
      confirmationName: queryInput.queryName
    })).resolves.toEqual({
      ok: false,
      code: 'not_found',
      message: 'not_found'
    })
  })

  it('maps persistence configuration failures cleanly when deleting queries', async () => {
    getAppDatabaseMock.mockImplementation(() => {
      throw new AppDatabaseConfigurationError('missing db')
    })

    const { deleteSavedSqlQuery } = await import(
      '../../../server/services/saved-sql-queries'
    )

    await expect(deleteSavedSqlQuery(authContext, {
      queryId: 'query-1',
      confirmationName: queryInput.queryName
    })).resolves.toEqual({
      ok: false,
      code: 'persistence_unavailable',
      message: 'persistence_unavailable'
    })
  })

  it('returns unexpected_error when deleting a query fails unexpectedly', async () => {
    const querySelectBuilder = {
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      executeTakeFirst: vi.fn().mockRejectedValue(new Error('boom'))
    }
    const mockDb = {
      selectFrom: vi.fn().mockReturnValue(querySelectBuilder)
    }
    getAppDatabaseMock.mockReturnValue(mockDb)
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { deleteSavedSqlQuery } = await import(
      '../../../server/services/saved-sql-queries'
    )

    await expect(deleteSavedSqlQuery(authContext, {
      queryId: 'query-1',
      confirmationName: queryInput.queryName
    })).resolves.toEqual({
      ok: false,
      code: 'unexpected_error',
      message: 'unexpected_error'
    })
    expect(consoleErrorSpy).toHaveBeenCalled()

    consoleErrorSpy.mockRestore()
  })

  it('tests a saved query through the selected saved connection', async () => {
    const connectionSelectBuilder = {
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      executeTakeFirst: vi.fn().mockResolvedValue({
        connection_id: queryInput.connectionId,
        database_type: 'postgres',
        encrypted_secret: 'encrypted-connection'
      })
    }
    const mockDb = {
      selectFrom: vi.fn().mockReturnValue(connectionSelectBuilder)
    }
    getAppDatabaseMock.mockReturnValue(mockDb)
    testDatabaseReadOnlyQueryMock.mockResolvedValue({
      ok: true,
      code: 'success',
      message: 'success',
      columns: ['id', 'name'],
      rows: [{
        id: 1,
        name: 'Alice'
      }],
      rowLimit: 25
    })

    const { testSavedSqlQuery } = await import(
      '../../../server/services/saved-sql-queries'
    )

    await expect(testSavedSqlQuery(authContext, {
      connectionId: queryInput.connectionId,
      sql: queryInput.sql
    })).resolves.toEqual({
      ok: true,
      code: 'success',
      columns: ['id', 'name'],
      rows: [{
        id: 1,
        name: 'Alice'
      }],
      rowLimit: 25
    })
    expect(decryptSavedDatabaseConnectionSecretMock).toHaveBeenCalledWith(
      'encrypted-connection'
    )
    expect(testDatabaseReadOnlyQueryMock).toHaveBeenCalledWith({
      databaseType: 'postgres',
      host: 'db.internal',
      port: 5432,
      databaseName: 'app_db',
      username: 'admin',
      password: 'secret',
      sslMode: 'disable',
      sql: queryInput.sql
    })
  })

  it('returns saved_connection_not_found when the selected saved connection does not exist for query tests', async () => {
    const connectionSelectBuilder = {
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      executeTakeFirst: vi.fn().mockResolvedValue(undefined)
    }
    const mockDb = {
      selectFrom: vi.fn().mockReturnValue(connectionSelectBuilder)
    }
    getAppDatabaseMock.mockReturnValue(mockDb)

    const { testSavedSqlQuery } = await import(
      '../../../server/services/saved-sql-queries'
    )

    await expect(testSavedSqlQuery(authContext, {
      connectionId: queryInput.connectionId,
      sql: queryInput.sql
    })).resolves.toEqual({
      ok: false,
      code: 'saved_connection_not_found',
      message: 'saved_connection_not_found'
    })
    expect(testDatabaseReadOnlyQueryMock).not.toHaveBeenCalled()
  })

  it('passes client-safe SQL execution details through for query failures', async () => {
    const connectionSelectBuilder = {
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      executeTakeFirst: vi.fn().mockResolvedValue({
        connection_id: queryInput.connectionId,
        database_type: 'postgres',
        encrypted_secret: 'encrypted-connection'
      })
    }
    const mockDb = {
      selectFrom: vi.fn().mockReturnValue(connectionSelectBuilder)
    }
    getAppDatabaseMock.mockReturnValue(mockDb)
    testDatabaseReadOnlyQueryMock.mockResolvedValue({
      ok: false,
      code: 'query_rejected',
      message: 'query_rejected',
      details: 'relation "missing_table" does not exist'
    })

    const { testSavedSqlQuery } = await import(
      '../../../server/services/saved-sql-queries'
    )

    await expect(testSavedSqlQuery(authContext, {
      connectionId: queryInput.connectionId,
      sql: queryInput.sql
    })).resolves.toEqual({
      ok: false,
      code: 'query_rejected',
      message: 'query_rejected',
      details: 'relation "missing_table" does not exist'
    })
  })

  it('does not expose connection or authentication failure details to the UI', async () => {
    const connectionSelectBuilder = {
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      executeTakeFirst: vi.fn().mockResolvedValue({
        connection_id: queryInput.connectionId,
        database_type: 'postgres',
        encrypted_secret: 'encrypted-connection'
      })
    }
    const mockDb = {
      selectFrom: vi.fn().mockReturnValue(connectionSelectBuilder)
    }
    getAppDatabaseMock.mockReturnValue(mockDb)
    testDatabaseReadOnlyQueryMock.mockResolvedValue({
      ok: false,
      code: 'authentication_failed',
      message: 'authentication_failed',
      details: 'password authentication failed for user "admin"'
    })

    const { testSavedSqlQuery } = await import(
      '../../../server/services/saved-sql-queries'
    )

    await expect(testSavedSqlQuery(authContext, {
      connectionId: queryInput.connectionId,
      sql: queryInput.sql
    })).resolves.toEqual({
      ok: false,
      code: 'authentication_failed',
      message: 'authentication_failed'
    })
  })

  it('maps connection secret configuration failures cleanly when testing queries', async () => {
    const connectionSelectBuilder = {
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      executeTakeFirst: vi.fn().mockResolvedValue({
        connection_id: queryInput.connectionId,
        database_type: 'postgres',
        encrypted_secret: 'encrypted-connection'
      })
    }
    const mockDb = {
      selectFrom: vi.fn().mockReturnValue(connectionSelectBuilder)
    }
    getAppDatabaseMock.mockReturnValue(mockDb)
    decryptSavedDatabaseConnectionSecretMock.mockImplementation(() => {
      throw new DatabaseConnectionEncryptionConfigurationError('missing key')
    })

    const { testSavedSqlQuery } = await import(
      '../../../server/services/saved-sql-queries'
    )

    await expect(testSavedSqlQuery(authContext, {
      connectionId: queryInput.connectionId,
      sql: queryInput.sql
    })).resolves.toEqual({
      ok: false,
      code: 'persistence_unavailable',
      message: 'persistence_unavailable'
    })
  })

  it('returns unexpected_error when query testing fails unexpectedly', async () => {
    const connectionSelectBuilder = {
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      executeTakeFirst: vi.fn().mockRejectedValue(new Error('boom'))
    }
    const mockDb = {
      selectFrom: vi.fn().mockReturnValue(connectionSelectBuilder)
    }
    getAppDatabaseMock.mockReturnValue(mockDb)
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { testSavedSqlQuery } = await import(
      '../../../server/services/saved-sql-queries'
    )

    await expect(testSavedSqlQuery(authContext, {
      connectionId: queryInput.connectionId,
      sql: queryInput.sql
    })).resolves.toEqual({
      ok: false,
      code: 'unexpected_error',
      message: 'unexpected_error'
    })
    expect(consoleErrorSpy).toHaveBeenCalled()

    consoleErrorSpy.mockRestore()
  })
})

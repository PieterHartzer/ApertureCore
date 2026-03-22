import { beforeEach, describe, expect, it, vi } from 'vitest'

const getAppDatabaseMock = vi.fn()

class AppDatabaseConfigurationError extends Error {}

vi.mock('../../../server/utils/app-database', () => ({
  getAppDatabase: getAppDatabaseMock,
  AppDatabaseConfigurationError
}))

const authContext = {
  userId: 'user-1',
  organizationId: 'org-1',
  organizationName: 'ACME',
  organizationPrimaryDomain: 'acme.test'
}

const createMockDb = () => ({
  selectFrom: vi.fn().mockReturnValue({
    innerJoin: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue([])
  })
})

describe('saved SQL query persistence service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('maps persistence configuration failures cleanly', async () => {
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
    expect(selectBuilder.where).toHaveBeenNthCalledWith(
      1,
      'query.organization_id',
      '=',
      expect.any(String)
    )
    expect(selectBuilder.where).toHaveBeenNthCalledWith(
      2,
      'query.deleted_at',
      'is',
      null
    )
    expect(selectBuilder.where).toHaveBeenNthCalledWith(
      3,
      'connection.deleted_at',
      'is',
      null
    )
  })

  it('returns unexpected_error when list queries fails unexpectedly', async () => {
    const mockDb = createMockDb()
    mockDb.selectFrom = vi.fn().mockReturnValue({
      innerJoin: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      execute: vi.fn().mockRejectedValue(new Error('boom'))
    })
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
})

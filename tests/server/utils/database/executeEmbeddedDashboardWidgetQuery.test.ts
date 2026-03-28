import { beforeEach, describe, expect, it, vi } from 'vitest'

const getAppDatabaseMock = vi.fn()
const executeResolvedSavedQueryMock = vi.fn()

class AppDatabaseConfigurationError extends Error {}
class DatabaseConnectionEncryptionConfigurationError extends Error {}
class SavedSqlQueryEncryptionConfigurationError extends Error {}

vi.mock('../../../../server/utils/app-database', () => ({
  getAppDatabase: getAppDatabaseMock,
  AppDatabaseConfigurationError
}))

vi.mock('../../../../server/utils/database/executeQuery', () => ({
  executeResolvedSavedQuery: executeResolvedSavedQueryMock
}))

vi.mock('../../../../server/utils/database-connection-secrets', () => ({
  DatabaseConnectionEncryptionConfigurationError
}))

vi.mock('../../../../server/utils/saved-sql-query-secrets', () => ({
  SavedSqlQueryEncryptionConfigurationError
}))

const createExecutionLookupBuilder = (
  executionResource: Record<string, unknown> | undefined
) => {
  const joinBuilder = {
    onRef: vi.fn().mockReturnThis()
  }
  const selectBuilder = {
    innerJoin: vi.fn().mockImplementation((...args: unknown[]) => {
      const callback = args[1]

      if (typeof callback === 'function') {
        callback(joinBuilder)
      }

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

describe('executeEmbeddedDashboardWidgetQuery utility', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('loads the embedded widget query through the dashboard/widget/query join and executes it', async () => {
    const executionResource = {
      encrypted_sql: 'encrypted-sql',
      database_type: 'postgres',
      encrypted_secret: 'encrypted-secret',
      widget_query_id: 'query-1',
      widget_updated_at: new Date('2026-03-25T00:00:00.000Z'),
      dashboard_updated_at: new Date('2026-03-25T01:00:00.000Z')
    }
    const { joinBuilder, selectBuilder } = createExecutionLookupBuilder(
      executionResource
    )
    const mockDb = {
      selectFrom: vi.fn().mockReturnValue(selectBuilder)
    }
    getAppDatabaseMock.mockReturnValue(mockDb)
    executeResolvedSavedQueryMock.mockResolvedValue({
      ok: true,
      code: 'success',
      columns: ['day', 'sales'],
      rows: [{
        day: '2026-03-25',
        sales: 120
      }],
      rowLimit: 1000
    })

    const { executeEmbeddedDashboardWidgetQuery } = await import(
      '../../../../server/utils/database/executeEmbeddedDashboardWidgetQuery'
    )

    await expect(
      executeEmbeddedDashboardWidgetQuery(
        '2f8f9425-55cf-4d8e-a446-638848de1942',
        '7c6d9425-55cf-4d8e-a446-638848de1942'
      )
    ).resolves.toEqual({
      ok: true,
      code: 'success',
      columns: ['day', 'sales'],
      rows: [{
        day: '2026-03-25',
        sales: 120
      }],
      rowLimit: 1000
    })
    expect(mockDb.selectFrom).toHaveBeenCalledWith('app_dashboard_widgets as widget')
    expect(selectBuilder.innerJoin).toHaveBeenCalledWith(
      'app_dashboards as dashboard',
      'dashboard.dashboard_id',
      'widget.dashboard_id'
    )
    expect(selectBuilder.innerJoin).toHaveBeenCalledWith(
      'app_saved_sql_queries as query',
      'query.query_id',
      'widget.query_id'
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
      'dashboard.embed_id',
      '=',
      '2f8f9425-55cf-4d8e-a446-638848de1942'
    )
    expect(selectBuilder.where).toHaveBeenNthCalledWith(
      4,
      'widget.widget_id',
      '=',
      '7c6d9425-55cf-4d8e-a446-638848de1942'
    )
    expect(executeResolvedSavedQueryMock).toHaveBeenCalledWith({
      encrypted_sql: 'encrypted-sql',
      database_type: 'postgres',
      encrypted_secret: 'encrypted-secret'
    })
  })

  it('resolves the embedded widget execution context with a cache version', async () => {
    const executionResource = {
      encrypted_sql: 'encrypted-sql',
      database_type: 'postgres',
      encrypted_secret: 'encrypted-secret',
      widget_query_id: 'query-1',
      widget_updated_at: new Date('2026-03-25T00:00:00.000Z'),
      dashboard_updated_at: new Date('2026-03-25T01:00:00.000Z')
    }
    const { selectBuilder } = createExecutionLookupBuilder(executionResource)
    getAppDatabaseMock.mockReturnValue({
      selectFrom: vi.fn().mockReturnValue(selectBuilder)
    })

    const { resolveEmbeddedDashboardWidgetExecutionContext } = await import(
      '../../../../server/utils/database/executeEmbeddedDashboardWidgetQuery'
    )

    await expect(
      resolveEmbeddedDashboardWidgetExecutionContext(
        '2f8f9425-55cf-4d8e-a446-638848de1942',
        '7c6d9425-55cf-4d8e-a446-638848de1942'
      )
    ).resolves.toEqual({
      executionResource: {
        encrypted_sql: 'encrypted-sql',
        database_type: 'postgres',
        encrypted_secret: 'encrypted-secret'
      },
      cacheVersion: 'query-1:2026-03-25T00:00:00.000Z:2026-03-25T01:00:00.000Z'
    })
  })

  it('returns not_found when the embedded widget is missing or not embeddable', async () => {
    const { selectBuilder } = createExecutionLookupBuilder(undefined)
    getAppDatabaseMock.mockReturnValue({
      selectFrom: vi.fn().mockReturnValue(selectBuilder)
    })

    const { executeEmbeddedDashboardWidgetQuery } = await import(
      '../../../../server/utils/database/executeEmbeddedDashboardWidgetQuery'
    )

    await expect(
      executeEmbeddedDashboardWidgetQuery(
        '2f8f9425-55cf-4d8e-a446-638848de1942',
        '7c6d9425-55cf-4d8e-a446-638848de1942'
      )
    ).resolves.toEqual({
      ok: false,
      code: 'not_found',
      message: 'not_found'
    })
    expect(executeResolvedSavedQueryMock).not.toHaveBeenCalled()
  })

  it('maps app database configuration failures to persistence_unavailable', async () => {
    getAppDatabaseMock.mockImplementation(() => {
      throw new AppDatabaseConfigurationError('missing db')
    })

    const { executeEmbeddedDashboardWidgetQuery } = await import(
      '../../../../server/utils/database/executeEmbeddedDashboardWidgetQuery'
    )

    await expect(
      executeEmbeddedDashboardWidgetQuery(
        '2f8f9425-55cf-4d8e-a446-638848de1942',
        '7c6d9425-55cf-4d8e-a446-638848de1942'
      )
    ).resolves.toEqual({
      ok: false,
      code: 'persistence_unavailable',
      message: 'persistence_unavailable'
    })
  })

  it('maps database secret configuration failures to persistence_unavailable', async () => {
    const { selectBuilder } = createExecutionLookupBuilder({
      encrypted_sql: 'encrypted-sql',
      database_type: 'postgres',
      encrypted_secret: 'encrypted-secret',
      widget_query_id: 'query-1',
      widget_updated_at: new Date('2026-03-25T00:00:00.000Z'),
      dashboard_updated_at: new Date('2026-03-25T01:00:00.000Z')
    })
    getAppDatabaseMock.mockReturnValue({
      selectFrom: vi.fn().mockReturnValue(selectBuilder)
    })
    executeResolvedSavedQueryMock.mockRejectedValue(
      new DatabaseConnectionEncryptionConfigurationError('missing key')
    )

    const { executeEmbeddedDashboardWidgetQuery } = await import(
      '../../../../server/utils/database/executeEmbeddedDashboardWidgetQuery'
    )

    await expect(
      executeEmbeddedDashboardWidgetQuery(
        '2f8f9425-55cf-4d8e-a446-638848de1942',
        '7c6d9425-55cf-4d8e-a446-638848de1942'
      )
    ).resolves.toEqual({
      ok: false,
      code: 'persistence_unavailable',
      message: 'persistence_unavailable'
    })
  })

  it('maps saved query secret configuration failures to persistence_unavailable', async () => {
    const { selectBuilder } = createExecutionLookupBuilder({
      encrypted_sql: 'encrypted-sql',
      database_type: 'postgres',
      encrypted_secret: 'encrypted-secret',
      widget_query_id: 'query-1',
      widget_updated_at: new Date('2026-03-25T00:00:00.000Z'),
      dashboard_updated_at: new Date('2026-03-25T01:00:00.000Z')
    })
    getAppDatabaseMock.mockReturnValue({
      selectFrom: vi.fn().mockReturnValue(selectBuilder)
    })
    executeResolvedSavedQueryMock.mockRejectedValue(
      new SavedSqlQueryEncryptionConfigurationError('missing key')
    )

    const { executeEmbeddedDashboardWidgetQuery } = await import(
      '../../../../server/utils/database/executeEmbeddedDashboardWidgetQuery'
    )

    await expect(
      executeEmbeddedDashboardWidgetQuery(
        '2f8f9425-55cf-4d8e-a446-638848de1942',
        '7c6d9425-55cf-4d8e-a446-638848de1942'
      )
    ).resolves.toEqual({
      ok: false,
      code: 'persistence_unavailable',
      message: 'persistence_unavailable'
    })
  })

  it('returns unexpected_error when query execution fails unexpectedly', async () => {
    const { selectBuilder } = createExecutionLookupBuilder({
      encrypted_sql: 'encrypted-sql',
      database_type: 'postgres',
      encrypted_secret: 'encrypted-secret',
      widget_query_id: 'query-1',
      widget_updated_at: new Date('2026-03-25T00:00:00.000Z'),
      dashboard_updated_at: new Date('2026-03-25T01:00:00.000Z')
    })
    getAppDatabaseMock.mockReturnValue({
      selectFrom: vi.fn().mockReturnValue(selectBuilder)
    })
    executeResolvedSavedQueryMock.mockRejectedValue(new Error('boom'))
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { executeEmbeddedDashboardWidgetQuery } = await import(
      '../../../../server/utils/database/executeEmbeddedDashboardWidgetQuery'
    )

    await expect(
      executeEmbeddedDashboardWidgetQuery(
        '2f8f9425-55cf-4d8e-a446-638848de1942',
        '7c6d9425-55cf-4d8e-a446-638848de1942'
      )
    ).resolves.toEqual({
      ok: false,
      code: 'unexpected_error',
      message: 'unexpected_error'
    })
    expect(consoleErrorSpy).toHaveBeenCalled()

    consoleErrorSpy.mockRestore()
  })
})

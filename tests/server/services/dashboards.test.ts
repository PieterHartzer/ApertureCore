import { beforeEach, describe, expect, it, vi } from 'vitest'

const getAppDatabaseMock = vi.fn()
const mapOrganizationIdToStorageMock = vi.fn()
const upsertOrganizationMock = vi.fn()

class AppDatabaseConfigurationError extends Error {}

vi.mock('../../../server/utils/app-database', () => ({
  getAppDatabase: getAppDatabaseMock,
  AppDatabaseConfigurationError
}))

vi.mock('../../../server/services/organization', () => ({
  mapOrganizationIdToStorage: mapOrganizationIdToStorageMock,
  upsertOrganization: upsertOrganizationMock
}))

const authContext = {
  userId: 'user-1',
  organizationId: 'org-1',
  organizationName: 'ACME',
  organizationPrimaryDomain: 'acme.test'
}

const createSelectBuilder = (result: unknown) => ({
  select: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockReturnThis(),
  execute: vi.fn().mockResolvedValue(result),
  executeTakeFirst: vi.fn().mockResolvedValue(
    Array.isArray(result)
      ? result[0]
      : result
  )
})

describe('dashboard persistence service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mapOrganizationIdToStorageMock.mockReturnValue('org-storage-1')
    upsertOrganizationMock.mockResolvedValue(undefined)
  })

  it('lists dashboards with widget counts', async () => {
    const dashboardsSelectBuilder = createSelectBuilder([{
      dashboard_id: 'dashboard-1',
      dashboard_name: 'Executive overview',
      embed_id: 'embed-1',
      embed_enabled: true,
      created_at: new Date('2026-03-24T00:00:00.000Z'),
      updated_at: new Date('2026-03-24T01:00:00.000Z')
    }])
    const widgetsSelectBuilder = createSelectBuilder([
      { dashboard_id: 'dashboard-1' },
      { dashboard_id: 'dashboard-1' }
    ])

    getAppDatabaseMock.mockReturnValue({
      selectFrom: vi.fn().mockImplementation((table: string) => {
        return table === 'app_dashboards'
          ? dashboardsSelectBuilder
          : widgetsSelectBuilder
      })
    })

    const { listDashboards } = await import('../../../server/services/dashboards')

    await expect(listDashboards(authContext)).resolves.toEqual({
      ok: true,
      code: 'success',
      dashboards: [{
        id: 'dashboard-1',
        dashboardName: 'Executive overview',
        embedId: 'embed-1',
        embedEnabled: true,
        widgetCount: 2,
        createdAt: '2026-03-24T00:00:00.000Z',
        updatedAt: '2026-03-24T01:00:00.000Z'
      }]
    })
  })

  it('saves dashboards atomically and returns the updated widget set', async () => {
    const dashboardRow = {
      dashboard_id: 'dashboard-1',
      dashboard_name: 'Executive overview',
      embed_id: 'embed-1',
      embed_enabled: false,
      created_at: new Date('2026-03-24T00:00:00.000Z'),
      updated_at: new Date('2026-03-24T01:00:00.000Z')
    }
    const dashboardLookupBuilder = createSelectBuilder(dashboardRow)
    const queryLookupBuilder = createSelectBuilder([{
      query_id: '1c6d9425-55cf-4d8e-a446-638848de1942'
    }])
    const widgetLookupBuilder = createSelectBuilder([{
      widget_id: '7c6d9425-55cf-4d8e-a446-638848de1942',
      dashboard_id: 'dashboard-1',
      query_id: '1c6d9425-55cf-4d8e-a446-638848de1942',
      widget_title: 'Revenue',
      plugin_id: 'table',
      plugin_config: {
        visibleColumns: ['sales']
      },
      layout: {
        w: 6,
        h: 4,
        minW: 3,
        minH: 3
      },
      refresh_interval_seconds: 15
    }])
    const txMock = {
      selectFrom: vi.fn().mockImplementation((table: string) => {
        if (table === 'app_dashboards') {
          return dashboardLookupBuilder
        }

        if (table === 'app_saved_sql_queries') {
          return queryLookupBuilder
        }

        return widgetLookupBuilder
      }),
      updateTable: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        executeTakeFirst: vi.fn().mockResolvedValue(undefined)
      }),
      deleteFrom: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue(undefined)
      }),
      insertInto: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue(undefined)
      })
    }

    getAppDatabaseMock.mockReturnValue({
      transaction: vi.fn().mockReturnValue({
        execute: async (callback: (tx: typeof txMock) => Promise<unknown>) => {
          return await callback(txMock)
        }
      })
    })

    const { saveDashboard } = await import('../../../server/services/dashboards')

    await expect(saveDashboard(authContext, {
      dashboardId: 'dashboard-1',
      dashboardName: 'Executive overview',
      embedEnabled: true,
      widgets: [{
        id: '7c6d9425-55cf-4d8e-a446-638848de1942',
        title: 'Revenue',
        queryId: '1c6d9425-55cf-4d8e-a446-638848de1942',
        pluginId: 'table',
        pluginConfig: {
          visibleColumns: ['sales']
        },
        layout: {
          w: 6,
          h: 4,
          minW: 3,
          minH: 3
        },
        refreshIntervalSeconds: 15
      }]
    })).resolves.toEqual({
      ok: true,
      code: 'success',
      dashboard: {
        id: 'dashboard-1',
        dashboardName: 'Executive overview',
        embedId: 'embed-1',
        embedEnabled: false,
        widgetCount: 1,
        createdAt: '2026-03-24T00:00:00.000Z',
        updatedAt: '2026-03-24T01:00:00.000Z',
        widgets: [{
          id: '7c6d9425-55cf-4d8e-a446-638848de1942',
          dashboardId: 'dashboard-1',
          title: 'Revenue',
          queryId: '1c6d9425-55cf-4d8e-a446-638848de1942',
          pluginId: 'table',
          pluginConfig: {
            visibleColumns: ['sales']
          },
          layout: {
            w: 6,
            h: 4,
            minW: 3,
            minH: 3
          },
          refreshIntervalSeconds: 15
        }]
      }
    })
    expect(txMock.deleteFrom).toHaveBeenCalledWith('app_dashboard_widgets')
    expect(txMock.insertInto).toHaveBeenCalledWith('app_dashboard_widgets')
  })

  it('returns not_found when a dashboard save references queries outside the organisation', async () => {
    const dashboardLookupBuilder = createSelectBuilder({
      dashboard_id: 'dashboard-1',
      dashboard_name: 'Executive overview',
      embed_id: 'embed-1',
      embed_enabled: false,
      created_at: new Date('2026-03-24T00:00:00.000Z'),
      updated_at: new Date('2026-03-24T01:00:00.000Z')
    })
    const queryLookupBuilder = createSelectBuilder([])
    const txMock = {
      selectFrom: vi.fn().mockImplementation((table: string) => {
        return table === 'app_dashboards'
          ? dashboardLookupBuilder
          : queryLookupBuilder
      }),
      updateTable: vi.fn(),
      deleteFrom: vi.fn(),
      insertInto: vi.fn()
    }

    getAppDatabaseMock.mockReturnValue({
      transaction: vi.fn().mockReturnValue({
        execute: async (callback: (tx: typeof txMock) => Promise<unknown>) => {
          return await callback(txMock)
        }
      })
    })

    const { saveDashboard } = await import('../../../server/services/dashboards')

    await expect(saveDashboard(authContext, {
      dashboardId: 'dashboard-1',
      dashboardName: 'Executive overview',
      embedEnabled: true,
      widgets: [{
        id: '7c6d9425-55cf-4d8e-a446-638848de1942',
        title: 'Revenue',
        queryId: '1c6d9425-55cf-4d8e-a446-638848de1942',
        pluginId: 'table',
        pluginConfig: {},
        layout: {
          w: 6,
          h: 4,
          minW: 3,
          minH: 3
        },
        refreshIntervalSeconds: 15
      }]
    })).resolves.toEqual({
      ok: false,
      code: 'not_found',
      message: 'not_found'
    })
  })

  it('loads embedded dashboards only when embedding is enabled', async () => {
    const dashboardSelectBuilder = createSelectBuilder({
      dashboard_id: 'dashboard-1',
      dashboard_name: 'Executive overview',
      embed_id: 'embed-1',
      embed_enabled: true,
      created_at: new Date('2026-03-24T00:00:00.000Z'),
      updated_at: new Date('2026-03-24T01:00:00.000Z')
    })
    const widgetSelectBuilder = createSelectBuilder([{
      widget_id: 'widget-1',
      dashboard_id: 'dashboard-1',
      query_id: 'query-1',
      widget_title: 'Revenue',
      plugin_id: 'table',
      plugin_config: {
        visibleColumns: ['sales']
      },
      layout: {
        w: 6,
        h: 4,
        minW: 3,
        minH: 3
      },
      refresh_interval_seconds: 15
    }])

    getAppDatabaseMock.mockReturnValue({
      selectFrom: vi.fn().mockImplementation((table: string) => {
        return table === 'app_dashboards'
          ? dashboardSelectBuilder
          : widgetSelectBuilder
      })
    })

    const { getEmbeddedDashboard } = await import('../../../server/services/dashboards')

    await expect(getEmbeddedDashboard('embed-1')).resolves.toEqual({
      ok: true,
      code: 'success',
      dashboard: {
        embedId: 'embed-1',
        dashboardName: 'Executive overview',
        updatedAt: '2026-03-24T01:00:00.000Z',
        widgets: [{
          id: 'widget-1',
          title: 'Revenue',
          pluginId: 'table',
          pluginConfig: {
            visibleColumns: ['sales']
          },
          layout: {
            w: 6,
            h: 4,
            minW: 3,
            minH: 3
          },
          refreshIntervalSeconds: 15
        }]
      }
    })
  })
})

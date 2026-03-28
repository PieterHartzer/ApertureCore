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

const dashboardRow = {
  dashboard_id: 'dashboard-1',
  dashboard_name: 'Executive overview',
  embed_id: 'embed-1',
  embed_enabled: true,
  created_at: new Date('2026-03-24T00:00:00.000Z'),
  updated_at: new Date('2026-03-24T01:00:00.000Z')
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

const createInsertBuilder = (result: unknown) => ({
  values: vi.fn().mockReturnThis(),
  returning: vi.fn().mockReturnThis(),
  executeTakeFirst: vi.fn().mockResolvedValue(result)
})

const createUpdateBuilder = () => ({
  set: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  executeTakeFirst: vi.fn().mockResolvedValue(undefined)
})

const createDeleteBuilder = () => ({
  where: vi.fn().mockReturnThis(),
  execute: vi.fn().mockResolvedValue(undefined)
})

describe('dashboard persistence service additional coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mapOrganizationIdToStorageMock.mockReturnValue('org-storage-1')
    upsertOrganizationMock.mockResolvedValue(undefined)
  })

  it('returns an empty dashboard list when the organisation has no dashboards', async () => {
    const dashboardSelectBuilder = createSelectBuilder([])

    getAppDatabaseMock.mockReturnValue({
      selectFrom: vi.fn().mockReturnValue(dashboardSelectBuilder)
    })

    const { listDashboards } = await import('../../../server/services/dashboards')

    await expect(listDashboards(authContext)).resolves.toEqual({
      ok: true,
      code: 'success',
      dashboards: []
    })
  })

  it('maps list dashboard persistence failures to persistence_unavailable', async () => {
    getAppDatabaseMock.mockImplementation(() => {
      throw new AppDatabaseConfigurationError('missing db')
    })

    const { listDashboards } = await import('../../../server/services/dashboards')

    await expect(listDashboards(authContext)).resolves.toEqual({
      ok: false,
      code: 'persistence_unavailable',
      message: 'persistence_unavailable'
    })
  })

  it('maps unexpected list dashboard failures to unexpected_error', async () => {
    const dashboardSelectBuilder = createSelectBuilder([])
    dashboardSelectBuilder.execute.mockRejectedValue(new Error('boom'))
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    getAppDatabaseMock.mockReturnValue({
      selectFrom: vi.fn().mockReturnValue(dashboardSelectBuilder)
    })

    const { listDashboards } = await import('../../../server/services/dashboards')

    await expect(listDashboards(authContext)).resolves.toEqual({
      ok: false,
      code: 'unexpected_error',
      message: 'unexpected_error'
    })
    expect(consoleErrorSpy).toHaveBeenCalled()

    consoleErrorSpy.mockRestore()
  })

  it('loads dashboard details and normalizes widget plugin config and layout', async () => {
    const dashboardSelectBuilder = createSelectBuilder(dashboardRow)
    const widgetSelectBuilder = createSelectBuilder([
      {
        widget_id: 'widget-1',
        dashboard_id: 'dashboard-1',
        query_id: 'query-1',
        widget_title: 'Fallback widget',
        plugin_id: 'table',
        plugin_config: ['not-a-record'],
        layout: 'not-a-record',
        refresh_interval_seconds: 0
      },
      {
        widget_id: 'widget-2',
        dashboard_id: 'dashboard-1',
        query_id: 'query-2',
        widget_title: 'Normalized widget',
        plugin_id: 'line-chart',
        plugin_config: {
          visibleColumns: ['sales', 'sales', null, '  ', 'region'],
          showTrend: true,
          threshold: 5,
          nestedConfig: {
            unsupported: true
          }
        },
        layout: {
          x: -1,
          y: 2,
          w: 2,
          h: 1,
          minW: 4,
          minH: 3,
          maxW: 8,
          maxH: 6
        },
        refresh_interval_seconds: 30
      }
    ])

    getAppDatabaseMock.mockReturnValue({
      selectFrom: vi.fn().mockImplementation((table: string) => {
        return table === 'app_dashboards'
          ? dashboardSelectBuilder
          : widgetSelectBuilder
      })
    })

    const { getDashboard } = await import('../../../server/services/dashboards')

    await expect(getDashboard(authContext, 'dashboard-1')).resolves.toEqual({
      ok: true,
      code: 'success',
      dashboard: {
        id: 'dashboard-1',
        dashboardName: 'Executive overview',
        embedId: 'embed-1',
        embedEnabled: true,
        widgetCount: 2,
        createdAt: '2026-03-24T00:00:00.000Z',
        updatedAt: '2026-03-24T01:00:00.000Z',
        widgets: [
          {
            id: 'widget-1',
            dashboardId: 'dashboard-1',
            title: 'Fallback widget',
            queryId: 'query-1',
            pluginId: 'table',
            pluginConfig: {},
            layout: {
              w: 6,
              h: 4,
              minW: 3,
              minH: 3
            },
            refreshIntervalSeconds: 60
          },
          {
            id: 'widget-2',
            dashboardId: 'dashboard-1',
            title: 'Normalized widget',
            queryId: 'query-2',
            pluginId: 'line-chart',
            pluginConfig: {
              visibleColumns: ['sales', 'region'],
              showTrend: true,
              threshold: 5,
              nestedConfig: null
            },
            layout: {
              x: undefined,
              y: 2,
              w: 4,
              h: 3,
              minW: 4,
              minH: 3,
              maxW: 8,
              maxH: 6
            },
            refreshIntervalSeconds: 30
          }
        ]
      }
    })
  })

  it('returns not_found when a dashboard does not exist', async () => {
    const dashboardSelectBuilder = createSelectBuilder(undefined)

    getAppDatabaseMock.mockReturnValue({
      selectFrom: vi.fn().mockReturnValue(dashboardSelectBuilder)
    })

    const { getDashboard } = await import('../../../server/services/dashboards')

    await expect(getDashboard(authContext, 'dashboard-1')).resolves.toEqual({
      ok: false,
      code: 'not_found',
      message: 'not_found'
    })
  })

  it('deletes a dashboard when the confirmation name matches', async () => {
    const dashboardSelectBuilder = createSelectBuilder({
      dashboard_id: 'dashboard-1',
      dashboard_name: 'Executive overview'
    })
    const updateBuilder = createUpdateBuilder()

    getAppDatabaseMock.mockReturnValue({
      selectFrom: vi.fn().mockReturnValue(dashboardSelectBuilder),
      updateTable: vi.fn().mockReturnValue(updateBuilder)
    })

    const { deleteDashboard } = await import('../../../server/services/dashboards')

    await expect(deleteDashboard(authContext, {
      dashboardId: 'dashboard-1',
      confirmationName: 'Executive overview'
    })).resolves.toEqual({
      ok: true,
      code: 'success'
    })
  })

  it('returns confirmation_mismatch when the dashboard name does not match', async () => {
    const dashboardSelectBuilder = createSelectBuilder({
      dashboard_id: 'dashboard-1',
      dashboard_name: 'Executive overview'
    })

    const updateTableMock = vi.fn()

    getAppDatabaseMock.mockReturnValue({
      selectFrom: vi.fn().mockReturnValue(dashboardSelectBuilder),
      updateTable: updateTableMock
    })

    const { deleteDashboard } = await import('../../../server/services/dashboards')

    await expect(deleteDashboard(authContext, {
      dashboardId: 'dashboard-1',
      confirmationName: 'Other dashboard'
    })).resolves.toEqual({
      ok: false,
      code: 'confirmation_mismatch',
      message: 'confirmation_mismatch'
    })
    expect(updateTableMock).not.toHaveBeenCalled()
  })

  it('returns not_found when deleting a missing dashboard', async () => {
    const dashboardSelectBuilder = createSelectBuilder(undefined)
    const updateTableMock = vi.fn()

    getAppDatabaseMock.mockReturnValue({
      selectFrom: vi.fn().mockReturnValue(dashboardSelectBuilder),
      updateTable: updateTableMock
    })

    const { deleteDashboard } = await import('../../../server/services/dashboards')

    await expect(deleteDashboard(authContext, {
      dashboardId: 'dashboard-1',
      confirmationName: 'Executive overview'
    })).resolves.toEqual({
      ok: false,
      code: 'not_found',
      message: 'not_found'
    })
    expect(updateTableMock).not.toHaveBeenCalled()
  })

  it('maps get dashboard persistence failures to persistence_unavailable', async () => {
    getAppDatabaseMock.mockImplementation(() => {
      throw new AppDatabaseConfigurationError('missing db')
    })

    const { getDashboard } = await import('../../../server/services/dashboards')

    await expect(getDashboard(authContext, 'dashboard-1')).resolves.toEqual({
      ok: false,
      code: 'persistence_unavailable',
      message: 'persistence_unavailable'
    })
  })

  it('maps delete dashboard persistence failures to persistence_unavailable', async () => {
    getAppDatabaseMock.mockImplementation(() => {
      throw new AppDatabaseConfigurationError('missing db')
    })

    const { deleteDashboard } = await import('../../../server/services/dashboards')

    await expect(deleteDashboard(authContext, {
      dashboardId: 'dashboard-1',
      confirmationName: 'Executive overview'
    })).resolves.toEqual({
      ok: false,
      code: 'persistence_unavailable',
      message: 'persistence_unavailable'
    })
  })

  it('maps unexpected get dashboard failures to unexpected_error', async () => {
    const dashboardSelectBuilder = createSelectBuilder(undefined)
    dashboardSelectBuilder.executeTakeFirst.mockRejectedValue(new Error('boom'))
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    getAppDatabaseMock.mockReturnValue({
      selectFrom: vi.fn().mockReturnValue(dashboardSelectBuilder)
    })

    const { getDashboard } = await import('../../../server/services/dashboards')

    await expect(getDashboard(authContext, 'dashboard-1')).resolves.toEqual({
      ok: false,
      code: 'unexpected_error',
      message: 'unexpected_error'
    })
    expect(consoleErrorSpy).toHaveBeenCalled()

    consoleErrorSpy.mockRestore()
  })

  it('creates dashboards and returns the persisted dashboard details', async () => {
    const insertBuilder = createInsertBuilder({
      dashboard_id: 'dashboard-1'
    })
    const dashboardSelectBuilder = createSelectBuilder({
      ...dashboardRow,
      embed_enabled: false
    })
    const widgetSelectBuilder = createSelectBuilder([])

    getAppDatabaseMock.mockReturnValue({
      insertInto: vi.fn().mockReturnValue(insertBuilder),
      selectFrom: vi.fn().mockImplementation((table: string) => {
        return table === 'app_dashboards'
          ? dashboardSelectBuilder
          : widgetSelectBuilder
      })
    })

    const { createDashboard } = await import('../../../server/services/dashboards')

    await expect(createDashboard(authContext, {
      dashboardName: 'Executive overview'
    })).resolves.toEqual({
      ok: true,
      code: 'success',
      dashboard: {
        id: 'dashboard-1',
        dashboardName: 'Executive overview',
        embedId: 'embed-1',
        embedEnabled: false,
        widgetCount: 0,
        createdAt: '2026-03-24T00:00:00.000Z',
        updatedAt: '2026-03-24T01:00:00.000Z',
        widgets: []
      }
    })
    expect(upsertOrganizationMock).toHaveBeenCalledWith(authContext)
  })

  it('returns unexpected_error when create does not return a dashboard reference', async () => {
    const insertBuilder = createInsertBuilder(undefined)

    getAppDatabaseMock.mockReturnValue({
      insertInto: vi.fn().mockReturnValue(insertBuilder)
    })

    const { createDashboard } = await import('../../../server/services/dashboards')

    await expect(createDashboard(authContext, {
      dashboardName: 'Executive overview'
    })).resolves.toEqual({
      ok: false,
      code: 'unexpected_error',
      message: 'unexpected_error'
    })
  })

  it('returns unexpected_error when the created dashboard cannot be reloaded', async () => {
    const insertBuilder = createInsertBuilder({
      dashboard_id: 'dashboard-1'
    })
    const dashboardSelectBuilder = createSelectBuilder(undefined)

    getAppDatabaseMock.mockReturnValue({
      insertInto: vi.fn().mockReturnValue(insertBuilder),
      selectFrom: vi.fn().mockReturnValue(dashboardSelectBuilder)
    })

    const { createDashboard } = await import('../../../server/services/dashboards')

    await expect(createDashboard(authContext, {
      dashboardName: 'Executive overview'
    })).resolves.toEqual({
      ok: false,
      code: 'unexpected_error',
      message: 'unexpected_error'
    })
  })

  it('maps duplicate dashboard names during create to duplicate_dashboard_name', async () => {
    const insertBuilder = createInsertBuilder(undefined)
    insertBuilder.executeTakeFirst.mockRejectedValue({
      code: '23505',
      constraint: 'app_dashboards_unique_name_per_org'
    })

    getAppDatabaseMock.mockReturnValue({
      insertInto: vi.fn().mockReturnValue(insertBuilder)
    })

    const { createDashboard } = await import('../../../server/services/dashboards')

    await expect(createDashboard(authContext, {
      dashboardName: 'Executive overview'
    })).resolves.toEqual({
      ok: false,
      code: 'duplicate_dashboard_name',
      message: 'duplicate_dashboard_name'
    })
  })

  it('maps create persistence failures to persistence_unavailable', async () => {
    getAppDatabaseMock.mockImplementation(() => {
      throw new AppDatabaseConfigurationError('missing db')
    })

    const { createDashboard } = await import('../../../server/services/dashboards')

    await expect(createDashboard(authContext, {
      dashboardName: 'Executive overview'
    })).resolves.toEqual({
      ok: false,
      code: 'persistence_unavailable',
      message: 'persistence_unavailable'
    })
  })

  it('maps unexpected create failures to unexpected_error', async () => {
    const insertBuilder = createInsertBuilder(undefined)
    insertBuilder.executeTakeFirst.mockRejectedValue(new Error('boom'))
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    getAppDatabaseMock.mockReturnValue({
      insertInto: vi.fn().mockReturnValue(insertBuilder)
    })

    const { createDashboard } = await import('../../../server/services/dashboards')

    await expect(createDashboard(authContext, {
      dashboardName: 'Executive overview'
    })).resolves.toEqual({
      ok: false,
      code: 'unexpected_error',
      message: 'unexpected_error'
    })
    expect(consoleErrorSpy).toHaveBeenCalled()

    consoleErrorSpy.mockRestore()
  })

  it('returns not_found when saving a dashboard that does not exist', async () => {
    const dashboardSelectBuilder = createSelectBuilder(undefined)
    const txMock = {
      selectFrom: vi.fn().mockReturnValue(dashboardSelectBuilder)
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
      widgets: []
    })).resolves.toEqual({
      ok: false,
      code: 'not_found',
      message: 'not_found'
    })
  })

  it('saves dashboards with no widgets without reinserting widget rows', async () => {
    const dashboardSelectBuilder = createSelectBuilder({
      ...dashboardRow,
      embed_enabled: false
    })
    const widgetSelectBuilder = createSelectBuilder([])
    const updateBuilder = createUpdateBuilder()
    const deleteBuilder = createDeleteBuilder()
    const txMock = {
      selectFrom: vi.fn().mockImplementation((table: string) => {
        return table === 'app_dashboards'
          ? dashboardSelectBuilder
          : widgetSelectBuilder
      }),
      updateTable: vi.fn().mockReturnValue(updateBuilder),
      deleteFrom: vi.fn().mockReturnValue(deleteBuilder),
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
      embedEnabled: false,
      widgets: []
    })).resolves.toEqual({
      ok: true,
      code: 'success',
      dashboard: {
        id: 'dashboard-1',
        dashboardName: 'Executive overview',
        embedId: 'embed-1',
        embedEnabled: false,
        widgetCount: 0,
        createdAt: '2026-03-24T00:00:00.000Z',
        updatedAt: '2026-03-24T01:00:00.000Z',
        widgets: []
      }
    })
    expect(txMock.deleteFrom).toHaveBeenCalledWith('app_dashboard_widgets')
    expect(txMock.insertInto).not.toHaveBeenCalled()
  })

  it('maps duplicate dashboard names during save to duplicate_dashboard_name', async () => {
    getAppDatabaseMock.mockReturnValue({
      transaction: vi.fn().mockReturnValue({
        execute: vi.fn().mockRejectedValue({
          code: '23505',
          constraint: 'app_dashboards_unique_name_per_org'
        })
      })
    })

    const { saveDashboard } = await import('../../../server/services/dashboards')

    await expect(saveDashboard(authContext, {
      dashboardId: 'dashboard-1',
      dashboardName: 'Executive overview',
      embedEnabled: true,
      widgets: []
    })).resolves.toEqual({
      ok: false,
      code: 'duplicate_dashboard_name',
      message: 'duplicate_dashboard_name'
    })
  })

  it('maps save persistence failures to persistence_unavailable', async () => {
    getAppDatabaseMock.mockImplementation(() => {
      throw new AppDatabaseConfigurationError('missing db')
    })

    const { saveDashboard } = await import('../../../server/services/dashboards')

    await expect(saveDashboard(authContext, {
      dashboardId: 'dashboard-1',
      dashboardName: 'Executive overview',
      embedEnabled: true,
      widgets: []
    })).resolves.toEqual({
      ok: false,
      code: 'persistence_unavailable',
      message: 'persistence_unavailable'
    })
  })

  it('maps unexpected save failures to unexpected_error', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    getAppDatabaseMock.mockReturnValue({
      transaction: vi.fn().mockReturnValue({
        execute: vi.fn().mockRejectedValue(new Error('boom'))
      })
    })

    const { saveDashboard } = await import('../../../server/services/dashboards')

    await expect(saveDashboard(authContext, {
      dashboardId: 'dashboard-1',
      dashboardName: 'Executive overview',
      embedEnabled: true,
      widgets: []
    })).resolves.toEqual({
      ok: false,
      code: 'unexpected_error',
      message: 'unexpected_error'
    })
    expect(consoleErrorSpy).toHaveBeenCalled()

    consoleErrorSpy.mockRestore()
  })

  it('returns not_found when an embedded dashboard is missing', async () => {
    const dashboardSelectBuilder = createSelectBuilder(undefined)

    getAppDatabaseMock.mockReturnValue({
      selectFrom: vi.fn().mockReturnValue(dashboardSelectBuilder)
    })

    const { getEmbeddedDashboard } = await import('../../../server/services/dashboards')

    await expect(getEmbeddedDashboard('embed-1')).resolves.toEqual({
      ok: false,
      code: 'not_found',
      message: 'not_found'
    })
  })

  it('normalizes embedded dashboard widgets before returning them', async () => {
    const dashboardSelectBuilder = createSelectBuilder(dashboardRow)
    const widgetSelectBuilder = createSelectBuilder([
      {
        widget_id: 'widget-1',
        dashboard_id: 'dashboard-1',
        query_id: 'query-1',
        widget_title: 'Revenue',
        plugin_id: 'table',
        plugin_config: {
          visibleColumns: ['sales', '', null, 'region']
        },
        layout: {
          x: 0,
          y: 1,
          w: 2,
          h: 2,
          minW: 4,
          minH: 3,
          maxW: 6,
          maxH: 5
        },
        refresh_interval_seconds: 0
      }
    ])

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
            visibleColumns: ['sales', 'region']
          },
          layout: {
            x: 0,
            y: 1,
            w: 4,
            h: 3,
            minW: 4,
            minH: 3,
            maxW: 6,
            maxH: 5
          },
          refreshIntervalSeconds: 60
        }]
      }
    })
  })

  it('maps embedded dashboard persistence failures to persistence_unavailable', async () => {
    getAppDatabaseMock.mockImplementation(() => {
      throw new AppDatabaseConfigurationError('missing db')
    })

    const { getEmbeddedDashboard } = await import('../../../server/services/dashboards')

    await expect(getEmbeddedDashboard('embed-1')).resolves.toEqual({
      ok: false,
      code: 'persistence_unavailable',
      message: 'persistence_unavailable'
    })
  })

  it('maps unexpected embedded dashboard failures to unexpected_error', async () => {
    const dashboardSelectBuilder = createSelectBuilder(undefined)
    dashboardSelectBuilder.executeTakeFirst.mockRejectedValue(new Error('boom'))
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    getAppDatabaseMock.mockReturnValue({
      selectFrom: vi.fn().mockReturnValue(dashboardSelectBuilder)
    })

    const { getEmbeddedDashboard } = await import('../../../server/services/dashboards')

    await expect(getEmbeddedDashboard('embed-1')).resolves.toEqual({
      ok: false,
      code: 'unexpected_error',
      message: 'unexpected_error'
    })
    expect(consoleErrorSpy).toHaveBeenCalled()

    consoleErrorSpy.mockRestore()
  })

  it('maps unexpected delete dashboard failures to unexpected_error', async () => {
    const dashboardSelectBuilder = createSelectBuilder({
      dashboard_id: 'dashboard-1',
      dashboard_name: 'Executive overview'
    })
    const updateBuilder = createUpdateBuilder()
    updateBuilder.executeTakeFirst.mockRejectedValue(new Error('boom'))
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    getAppDatabaseMock.mockReturnValue({
      selectFrom: vi.fn().mockReturnValue(dashboardSelectBuilder),
      updateTable: vi.fn().mockReturnValue(updateBuilder)
    })

    const { deleteDashboard } = await import('../../../server/services/dashboards')

    await expect(deleteDashboard(authContext, {
      dashboardId: 'dashboard-1',
      confirmationName: 'Executive overview'
    })).resolves.toEqual({
      ok: false,
      code: 'unexpected_error',
      message: 'unexpected_error'
    })
    expect(consoleErrorSpy).toHaveBeenCalled()

    consoleErrorSpy.mockRestore()
  })
})

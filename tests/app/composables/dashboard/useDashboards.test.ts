import { describe, expect, it, vi } from 'vitest'

describe('useDashboards', () => {
  it('lists dashboards through the API composable', async () => {
    const requestFetch = vi.fn().mockResolvedValue({
      ok: true,
      code: 'success',
      message: 'dashboards.list.success',
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

    const { useDashboards } = await import('../../../../../app/composables/dashboard/useDashboards')
    const dashboards = useDashboards(requestFetch)

    await expect(dashboards.listDashboards()).resolves.toEqual({
      ok: true,
      code: 'success',
      message: 'dashboards.list.success',
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
    expect(requestFetch).toHaveBeenCalledWith('/api/dashboards')
  })

  it('returns structured list errors from failed requests', async () => {
    const requestFetch = vi.fn().mockRejectedValue({
      data: {
        ok: false,
        code: 'forbidden',
        message: 'dashboards.list.errors.forbidden',
        messageKey: 'dashboards.list.errors.forbidden'
      }
    })

    const { useDashboards } = await import('../../../../../app/composables/dashboard/useDashboards')
    const dashboards = useDashboards(requestFetch)

    await expect(dashboards.listDashboards()).resolves.toEqual({
      ok: false,
      code: 'forbidden',
      message: 'dashboards.list.errors.forbidden',
      messageKey: 'dashboards.list.errors.forbidden'
    })
  })

  it('loads a single dashboard through the API composable', async () => {
    const requestFetch = vi.fn().mockResolvedValue({
      ok: true,
      code: 'success',
      message: 'dashboards.get.success',
      dashboard: {
        id: 'dashboard-1',
        dashboardName: 'Executive overview',
        embedId: 'embed-1',
        embedEnabled: true,
        widgetCount: 0,
        createdAt: '2026-03-24T00:00:00.000Z',
        updatedAt: '2026-03-24T01:00:00.000Z',
        widgets: []
      }
    })

    const { useDashboards } = await import('../../../../../app/composables/dashboard/useDashboards')
    const dashboards = useDashboards(requestFetch)

    await expect(dashboards.getDashboard('dashboard-1')).resolves.toEqual({
      ok: true,
      code: 'success',
      message: 'dashboards.get.success',
      dashboard: {
        id: 'dashboard-1',
        dashboardName: 'Executive overview',
        embedId: 'embed-1',
        embedEnabled: true,
        widgetCount: 0,
        createdAt: '2026-03-24T00:00:00.000Z',
        updatedAt: '2026-03-24T01:00:00.000Z',
        widgets: []
      }
    })
    expect(requestFetch).toHaveBeenCalledWith('/api/dashboards/dashboard-1')
  })

  it('returns structured dashboard get errors from failed requests', async () => {
    const requestFetch = vi.fn().mockRejectedValue({
      data: {
        ok: false,
        code: 'not_found',
        message: 'dashboards.get.errors.notFound',
        messageKey: 'dashboards.get.errors.notFound'
      }
    })

    const { useDashboards } = await import('../../../../../app/composables/dashboard/useDashboards')
    const dashboards = useDashboards(requestFetch)

    await expect(dashboards.getDashboard('dashboard-1')).resolves.toEqual({
      ok: false,
      code: 'not_found',
      message: 'dashboards.get.errors.notFound',
      messageKey: 'dashboards.get.errors.notFound'
    })
  })

  it('creates dashboards through the API composable', async () => {
    const requestFetch = vi.fn().mockResolvedValue({
      ok: true,
      code: 'success',
      message: 'dashboards.create.success',
      dashboard: {
        id: 'dashboard-1',
        dashboardName: 'Executive overview',
        embedId: 'embed-1',
        embedEnabled: false,
        widgetCount: 0,
        createdAt: '2026-03-24T00:00:00.000Z',
        updatedAt: '2026-03-24T00:00:00.000Z',
        widgets: []
      }
    })

    const { useDashboards } = await import('../../../../../app/composables/dashboard/useDashboards')
    const dashboards = useDashboards(requestFetch)

    await expect(dashboards.createDashboard({
      dashboardName: 'Executive overview'
    })).resolves.toEqual({
      ok: true,
      code: 'success',
      message: 'dashboards.create.success',
      dashboard: {
        id: 'dashboard-1',
        dashboardName: 'Executive overview',
        embedId: 'embed-1',
        embedEnabled: false,
        widgetCount: 0,
        createdAt: '2026-03-24T00:00:00.000Z',
        updatedAt: '2026-03-24T00:00:00.000Z',
        widgets: []
      }
    })
    expect(requestFetch).toHaveBeenCalledWith('/api/dashboards', {
      method: 'POST',
      body: {
        dashboardName: 'Executive overview'
      }
    })
  })

  it('saves dashboards through the API composable', async () => {
    const requestFetch = vi.fn().mockResolvedValue({
      ok: true,
      code: 'success',
      message: 'dashboards.save.success',
      dashboard: {
        id: 'dashboard-1',
        dashboardName: 'Executive overview',
        embedId: 'embed-1',
        embedEnabled: true,
        widgetCount: 1,
        createdAt: '2026-03-24T00:00:00.000Z',
        updatedAt: '2026-03-24T01:00:00.000Z',
        widgets: []
      }
    })

    const { useDashboards } = await import('../../../../../app/composables/dashboard/useDashboards')
    const dashboards = useDashboards(requestFetch)

    await expect(dashboards.saveDashboard('dashboard-1', {
      dashboardName: 'Executive overview',
      embedEnabled: true,
      widgets: []
    })).resolves.toEqual({
      ok: true,
      code: 'success',
      message: 'dashboards.save.success',
      dashboard: {
        id: 'dashboard-1',
        dashboardName: 'Executive overview',
        embedId: 'embed-1',
        embedEnabled: true,
        widgetCount: 1,
        createdAt: '2026-03-24T00:00:00.000Z',
        updatedAt: '2026-03-24T01:00:00.000Z',
        widgets: []
      }
    })
    expect(requestFetch).toHaveBeenCalledWith('/api/dashboards/dashboard-1', {
      method: 'PUT',
      body: {
        dashboardName: 'Executive overview',
        embedEnabled: true,
        widgets: []
      }
    })
  })

  it('returns structured save errors from failed requests', async () => {
    const requestFetch = vi.fn().mockRejectedValue({
      data: {
        ok: false,
        code: 'duplicate_dashboard_name',
        message: 'dashboards.save.errors.duplicateDashboardName',
        messageKey: 'dashboards.save.errors.duplicateDashboardName'
      }
    })

    const { useDashboards } = await import('../../../../../app/composables/dashboard/useDashboards')
    const dashboards = useDashboards(requestFetch)

    await expect(dashboards.saveDashboard('dashboard-1', {
      dashboardName: 'Executive overview',
      embedEnabled: true,
      widgets: []
    })).resolves.toEqual({
      ok: false,
      code: 'duplicate_dashboard_name',
      message: 'dashboards.save.errors.duplicateDashboardName',
      messageKey: 'dashboards.save.errors.duplicateDashboardName'
    })
  })

  it('falls back to the unexpected create error when the request throws without API data', async () => {
    const requestFetch = vi.fn().mockRejectedValue(new Error('network boom'))

    const { useDashboards } = await import('../../../../../app/composables/dashboard/useDashboards')
    const dashboards = useDashboards(requestFetch)

    await expect(dashboards.createDashboard({
      dashboardName: 'Executive overview'
    })).resolves.toEqual({
      ok: false,
      code: 'unexpected_error',
      message: 'dashboards.create.errors.unexpected',
      messageKey: 'dashboards.create.errors.unexpected'
    })
  })

  it('falls back to the unexpected save error when the request throws without API data', async () => {
    const requestFetch = vi.fn().mockRejectedValue(new Error('network boom'))

    const { useDashboards } = await import('../../../../../app/composables/dashboard/useDashboards')
    const dashboards = useDashboards(requestFetch)

    await expect(dashboards.saveDashboard('dashboard-1', {
      dashboardName: 'Executive overview',
      embedEnabled: true,
      widgets: []
    })).resolves.toEqual({
      ok: false,
      code: 'unexpected_error',
      message: 'dashboards.save.errors.unexpected',
      messageKey: 'dashboards.save.errors.unexpected'
    })
  })

  it('deletes dashboards through the API composable', async () => {
    const requestFetch = vi.fn().mockResolvedValue({
      ok: true,
      code: 'success',
      message: 'dashboards.delete.success'
    })

    const { useDashboards } = await import('../../../../../app/composables/dashboard/useDashboards')
    const dashboards = useDashboards(requestFetch)

    await expect(dashboards.deleteDashboard('dashboard-1', {
      confirmationName: 'Executive overview'
    })).resolves.toEqual({
      ok: true,
      code: 'success',
      message: 'dashboards.delete.success'
    })
    expect(requestFetch).toHaveBeenCalledWith('/api/dashboards/dashboard-1', {
      method: 'DELETE',
      body: {
        confirmationName: 'Executive overview'
      }
    })
  })

  it('returns structured delete errors from failed requests', async () => {
    const requestFetch = vi.fn().mockRejectedValue({
      data: {
        ok: false,
        code: 'confirmation_mismatch',
        message: 'dashboards.delete.errors.confirmationMismatch',
        messageKey: 'dashboards.delete.errors.confirmationMismatch'
      }
    })

    const { useDashboards } = await import('../../../../../app/composables/dashboard/useDashboards')
    const dashboards = useDashboards(requestFetch)

    await expect(dashboards.deleteDashboard('dashboard-1', {
      confirmationName: 'Executive overview'
    })).resolves.toEqual({
      ok: false,
      code: 'confirmation_mismatch',
      message: 'dashboards.delete.errors.confirmationMismatch',
      messageKey: 'dashboards.delete.errors.confirmationMismatch'
    })
  })

  it('falls back to the unexpected delete error when the request throws without API data', async () => {
    const requestFetch = vi.fn().mockRejectedValue(new Error('network boom'))

    const { useDashboards } = await import('../../../../../app/composables/dashboard/useDashboards')
    const dashboards = useDashboards(requestFetch)

    await expect(dashboards.deleteDashboard('dashboard-1', {
      confirmationName: 'Executive overview'
    })).resolves.toEqual({
      ok: false,
      code: 'unexpected_error',
      message: 'dashboards.delete.errors.unexpected',
      messageKey: 'dashboards.delete.errors.unexpected'
    })
  })
})

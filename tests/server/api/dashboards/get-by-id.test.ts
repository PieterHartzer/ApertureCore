import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const getAuthenticatedOrganizationContextMock = vi.fn()
const validateDashboardIdMock = vi.fn()
const getDashboardMock = vi.fn()
const setResponseStatusMock = vi.fn((event: Record<string, unknown>, status: number) => {
  event.statusCode = status
})

vi.mock('../../../../server/utils/auth-organization', () => ({
  getAuthenticatedOrganizationContext: getAuthenticatedOrganizationContextMock
}))

vi.mock('../../../../server/validators/dashboards', () => ({
  validateDashboardId: validateDashboardIdMock
}))

vi.mock('../../../../server/services/dashboards', () => ({
  getDashboard: getDashboardMock
}))

const loadHandler = async () => {
  vi.resetModules()
  vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
  vi.stubGlobal('setResponseStatus', setResponseStatusMock)

  return (await import('../../../../server/api/dashboards/[dashboardId].get')).default as (
    event: Record<string, unknown> & {
      context: {
        params?: Record<string, string>
      }
    }
  ) => Promise<unknown>
}

describe('GET /api/dashboards/:dashboardId', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getAuthenticatedOrganizationContextMock.mockReturnValue({
      userId: 'user-1',
      organizationId: 'org-1',
      organizationName: 'ACME'
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns a validation error when the dashboard id is invalid', async () => {
    validateDashboardIdMock.mockReturnValue({
      ok: false,
      code: 'invalid_input',
      issue: 'dashboard_id_invalid',
      field: 'dashboardId',
      message: 'dashboard_id_invalid'
    })

    const handler = await loadHandler()
    const event = {
      context: {
        params: {
          dashboardId: 'bad-id'
        }
      }
    }

    await expect(handler(event)).resolves.toEqual({
      ok: false,
      code: 'invalid_input',
      issue: 'dashboard_id_invalid',
      field: 'dashboardId',
      message: 'dashboards.get.errors.dashboardIdInvalid',
      messageKey: 'dashboards.get.errors.dashboardIdInvalid'
    })
    expect(event.statusCode).toBe(400)
    expect(getDashboardMock).not.toHaveBeenCalled()
  })

  it('returns the dashboard details', async () => {
    validateDashboardIdMock.mockReturnValue({
      ok: true,
      data: {
        dashboardId: 'dashboard-1'
      }
    })
    getDashboardMock.mockResolvedValue({
      ok: true,
      code: 'success',
      dashboard: {
        id: 'dashboard-1',
        dashboardName: 'Executive overview',
        embedId: 'embed-1',
        embedEnabled: true,
        widgetCount: 1,
        createdAt: '2026-03-24T00:00:00.000Z',
        updatedAt: '2026-03-24T01:00:00.000Z',
        widgets: [{
          id: 'widget-1',
          dashboardId: 'dashboard-1',
          title: 'Revenue',
          queryId: 'query-1',
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
      }
    })

    const handler = await loadHandler()
    const event = {
      context: {
        params: {
          dashboardId: 'dashboard-1'
        }
      }
    }

    await expect(handler(event)).resolves.toEqual({
      ok: true,
      code: 'success',
      message: 'dashboards.get.success',
      messageKey: 'dashboards.get.success',
      dashboard: {
        id: 'dashboard-1',
        dashboardName: 'Executive overview',
        embedId: 'embed-1',
        embedEnabled: true,
        widgetCount: 1,
        createdAt: '2026-03-24T00:00:00.000Z',
        updatedAt: '2026-03-24T01:00:00.000Z',
        widgets: [{
          id: 'widget-1',
          dashboardId: 'dashboard-1',
          title: 'Revenue',
          queryId: 'query-1',
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
      }
    })
    expect(event.statusCode).toBe(200)
  })

  it.each([
    ['not_found', 404, 'dashboards.get.errors.notFound'],
    ['persistence_unavailable', 503, 'dashboards.get.errors.persistenceUnavailable'],
    ['unexpected_error', 500, 'dashboards.get.errors.unexpected']
  ])(
    'maps service error %s to the correct status and message key',
    async (code, status, messageKey) => {
      validateDashboardIdMock.mockReturnValue({
        ok: true,
        data: {
          dashboardId: 'dashboard-1'
        }
      })
      getDashboardMock.mockResolvedValue({
        ok: false,
        code,
        message: code
      })

      const handler = await loadHandler()
      const event = {
        context: {
          params: {
            dashboardId: 'dashboard-1'
          }
        }
      }

      await expect(handler(event)).resolves.toEqual({
        ok: false,
        code,
        message: messageKey,
        messageKey
      })
      expect(event.statusCode).toBe(status)
    }
  )

  it('returns forbidden when the organization context is missing', async () => {
    validateDashboardIdMock.mockReturnValue({
      ok: true,
      data: {
        dashboardId: 'dashboard-1'
      }
    })
    getAuthenticatedOrganizationContextMock.mockImplementation(() => {
      throw {
        statusCode: 403
      }
    })

    const handler = await loadHandler()
    const event = {
      context: {
        params: {
          dashboardId: 'dashboard-1'
        }
      }
    }

    await expect(handler(event)).resolves.toEqual({
      ok: false,
      code: 'forbidden',
      message: 'dashboards.get.errors.forbidden',
      messageKey: 'dashboards.get.errors.forbidden'
    })
    expect(event.statusCode).toBe(403)
  })

  it('returns unexpected_error when loading throws unexpectedly', async () => {
    validateDashboardIdMock.mockReturnValue({
      ok: true,
      data: {
        dashboardId: 'dashboard-1'
      }
    })
    getDashboardMock.mockRejectedValue(new Error('boom'))
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const handler = await loadHandler()
    const event = {
      context: {
        params: {
          dashboardId: 'dashboard-1'
        }
      }
    }

    await expect(handler(event)).resolves.toEqual({
      ok: false,
      code: 'unexpected_error',
      message: 'dashboards.get.errors.unexpected',
      messageKey: 'dashboards.get.errors.unexpected'
    })
    expect(event.statusCode).toBe(500)
    expect(consoleErrorSpy).toHaveBeenCalled()

    consoleErrorSpy.mockRestore()
  })
})

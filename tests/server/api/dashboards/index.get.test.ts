import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const getAuthenticatedOrganizationContextMock = vi.fn()
const listDashboardsMock = vi.fn()
const setResponseStatusMock = vi.fn((event: Record<string, unknown>, status: number) => {
  event.statusCode = status
})

vi.mock('../../../../server/utils/auth-organization', () => ({
  getAuthenticatedOrganizationContext: getAuthenticatedOrganizationContextMock
}))

vi.mock('../../../../server/services/dashboards', () => ({
  listDashboards: listDashboardsMock
}))

const loadHandler = async () => {
  vi.resetModules()
  vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
  vi.stubGlobal('setResponseStatus', setResponseStatusMock)

  return (await import('../../../../server/api/dashboards/index.get')).default as (
    event: Record<string, unknown>
  ) => Promise<unknown>
}

describe('GET /api/dashboards', () => {
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

  it('returns the organization dashboards', async () => {
    listDashboardsMock.mockResolvedValue({
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

    const handler = await loadHandler()
    const event: Record<string, unknown> = {}

    await expect(handler(event)).resolves.toEqual({
      ok: true,
      code: 'success',
      message: 'dashboards.list.success',
      messageKey: 'dashboards.list.success',
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
    expect(event.statusCode).toBe(200)
  })

  it.each([
    ['persistence_unavailable', 503, 'dashboards.list.errors.persistenceUnavailable'],
    ['unexpected_error', 500, 'dashboards.list.errors.unexpected']
  ])(
    'maps service error %s to the correct status and message key',
    async (code, status, messageKey) => {
      listDashboardsMock.mockResolvedValue({
        ok: false,
        code,
        message: code
      })

      const handler = await loadHandler()
      const event: Record<string, unknown> = {}

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
    getAuthenticatedOrganizationContextMock.mockImplementation(() => {
      throw {
        statusCode: 403
      }
    })

    const handler = await loadHandler()
    const event: Record<string, unknown> = {}

    await expect(handler(event)).resolves.toEqual({
      ok: false,
      code: 'forbidden',
      message: 'dashboards.list.errors.forbidden',
      messageKey: 'dashboards.list.errors.forbidden'
    })
    expect(event.statusCode).toBe(403)
  })

  it('returns unexpected_error when listing throws unexpectedly', async () => {
    listDashboardsMock.mockRejectedValue(new Error('boom'))
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const handler = await loadHandler()
    const event: Record<string, unknown> = {}

    await expect(handler(event)).resolves.toEqual({
      ok: false,
      code: 'unexpected_error',
      message: 'dashboards.list.errors.unexpected',
      messageKey: 'dashboards.list.errors.unexpected'
    })
    expect(event.statusCode).toBe(500)
    expect(consoleErrorSpy).toHaveBeenCalled()

    consoleErrorSpy.mockRestore()
  })
})

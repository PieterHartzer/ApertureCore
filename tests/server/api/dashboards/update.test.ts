import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const getAuthenticatedOrganizationContextMock = vi.fn()
const validateSaveDashboardInputMock = vi.fn()
const saveDashboardMock = vi.fn()
const readBodyMock = vi.fn()
const setResponseStatusMock = vi.fn((event: Record<string, unknown>, status: number) => {
  event.statusCode = status
})

vi.mock('../../../../server/utils/auth-organization', () => ({
  getAuthenticatedOrganizationContext: getAuthenticatedOrganizationContextMock
}))

vi.mock('../../../../server/validators/dashboards', () => ({
  validateSaveDashboardInput: validateSaveDashboardInputMock
}))

vi.mock('../../../../server/services/dashboards', () => ({
  saveDashboard: saveDashboardMock
}))

const loadHandler = async () => {
  vi.resetModules()
  vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
  vi.stubGlobal('readBody', readBodyMock)
  vi.stubGlobal('setResponseStatus', setResponseStatusMock)

  return (await import('../../../../server/api/dashboards/[dashboardId].put')).default as (
    event: Record<string, unknown> & {
      context: {
        params?: Record<string, string>
      }
    }
  ) => Promise<unknown>
}

describe('PUT /api/dashboards/:dashboardId', () => {
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

  it('returns a validation error when the request body is invalid JSON', async () => {
    readBodyMock.mockRejectedValue(new Error('bad json'))

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
      code: 'invalid_input',
      issue: 'body_invalid',
      field: 'body',
      message: 'dashboards.save.errors.bodyInvalid',
      messageKey: 'dashboards.save.errors.bodyInvalid'
    })
    expect(event.statusCode).toBe(400)
    expect(validateSaveDashboardInputMock).not.toHaveBeenCalled()
    expect(saveDashboardMock).not.toHaveBeenCalled()
  })

  it('returns validator failures with the expected i18n key', async () => {
    readBodyMock.mockResolvedValue({})
    validateSaveDashboardInputMock.mockReturnValue({
      ok: false,
      code: 'invalid_input',
      issue: 'widgets_invalid',
      field: 'widgets',
      message: 'widgets_invalid'
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
      code: 'invalid_input',
      issue: 'widgets_invalid',
      field: 'widgets',
      message: 'dashboards.save.errors.widgetsInvalid',
      messageKey: 'dashboards.save.errors.widgetsInvalid'
    })
    expect(event.statusCode).toBe(400)
  })

  it('returns success when a dashboard is saved', async () => {
    const validatedInput = {
      dashboardId: 'dashboard-1',
      dashboardName: 'Executive overview',
      embedEnabled: true,
      widgets: []
    }

    readBodyMock.mockResolvedValue(validatedInput)
    validateSaveDashboardInputMock.mockReturnValue({
      ok: true,
      data: validatedInput
    })
    saveDashboardMock.mockResolvedValue({
      ok: true,
      code: 'success',
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
      message: 'dashboards.save.success',
      messageKey: 'dashboards.save.success',
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
    expect(event.statusCode).toBe(200)
  })

  it.each([
    ['not_found', 404, 'dashboards.save.errors.notFound'],
    ['duplicate_dashboard_name', 409, 'dashboards.save.errors.duplicateDashboardName'],
    ['persistence_unavailable', 503, 'dashboards.save.errors.persistenceUnavailable'],
    ['unexpected_error', 500, 'dashboards.save.errors.unexpected']
  ])(
    'maps service error %s to the correct status and message key',
    async (code, status, messageKey) => {
      readBodyMock.mockResolvedValue({})
      validateSaveDashboardInputMock.mockReturnValue({
        ok: true,
        data: {
          dashboardId: 'dashboard-1',
          dashboardName: 'Executive overview',
          embedEnabled: true,
          widgets: []
        }
      })
      saveDashboardMock.mockResolvedValue({
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
    readBodyMock.mockResolvedValue({})
    validateSaveDashboardInputMock.mockReturnValue({
      ok: true,
      data: {
        dashboardId: 'dashboard-1',
        dashboardName: 'Executive overview',
        embedEnabled: true,
        widgets: []
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
      message: 'dashboards.save.errors.forbidden',
      messageKey: 'dashboards.save.errors.forbidden'
    })
    expect(event.statusCode).toBe(403)
  })

  it('returns unexpected_error when dashboard saving throws unexpectedly', async () => {
    readBodyMock.mockResolvedValue({})
    validateSaveDashboardInputMock.mockReturnValue({
      ok: true,
      data: {
        dashboardId: 'dashboard-1',
        dashboardName: 'Executive overview',
        embedEnabled: true,
        widgets: []
      }
    })
    saveDashboardMock.mockRejectedValue(new Error('boom'))
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
      message: 'dashboards.save.errors.unexpected',
      messageKey: 'dashboards.save.errors.unexpected'
    })
    expect(event.statusCode).toBe(500)
    expect(consoleErrorSpy).toHaveBeenCalled()

    consoleErrorSpy.mockRestore()
  })
})

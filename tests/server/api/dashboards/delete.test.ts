import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const getAuthenticatedOrganizationContextMock = vi.fn()
const validateDeleteDashboardInputMock = vi.fn()
const deleteDashboardMock = vi.fn()
const readBodyMock = vi.fn()
const setResponseStatusMock = vi.fn((event: Record<string, unknown>, status: number) => {
  event.statusCode = status
})

vi.mock('../../../../server/utils/auth-organization', () => ({
  getAuthenticatedOrganizationContext: getAuthenticatedOrganizationContextMock
}))

vi.mock('../../../../server/validators/dashboards', () => ({
  validateDeleteDashboardInput: validateDeleteDashboardInputMock
}))

vi.mock('../../../../server/services/dashboards', () => ({
  deleteDashboard: deleteDashboardMock
}))

const loadHandler = async () => {
  vi.resetModules()
  vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
  vi.stubGlobal('readBody', readBodyMock)
  vi.stubGlobal('setResponseStatus', setResponseStatusMock)

  return (await import('../../../../server/api/dashboards/[dashboardId].delete')).default as (
    event: Record<string, unknown> & {
      context: {
        params?: Record<string, string>
      }
    }
  ) => Promise<unknown>
}

describe('DELETE /api/dashboards/:dashboardId', () => {
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
      message: 'dashboards.delete.errors.bodyInvalid',
      messageKey: 'dashboards.delete.errors.bodyInvalid'
    })
    expect(event.statusCode).toBe(400)
    expect(validateDeleteDashboardInputMock).not.toHaveBeenCalled()
    expect(deleteDashboardMock).not.toHaveBeenCalled()
  })

  it('returns validator failures with the expected i18n key', async () => {
    readBodyMock.mockResolvedValue({})
    validateDeleteDashboardInputMock.mockReturnValue({
      ok: false,
      code: 'invalid_input',
      issue: 'confirmation_name_required',
      field: 'confirmationName',
      message: 'confirmation_name_required'
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
      issue: 'confirmation_name_required',
      field: 'confirmationName',
      message: 'dashboards.delete.errors.confirmationNameRequired',
      messageKey: 'dashboards.delete.errors.confirmationNameRequired'
    })
    expect(event.statusCode).toBe(400)
  })

  it('returns success when a dashboard is deleted', async () => {
    const validatedInput = {
      dashboardId: 'dashboard-1',
      confirmationName: 'Executive overview'
    }

    readBodyMock.mockResolvedValue(validatedInput)
    validateDeleteDashboardInputMock.mockReturnValue({
      ok: true,
      data: validatedInput
    })
    deleteDashboardMock.mockResolvedValue({
      ok: true,
      code: 'success'
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
      message: 'dashboards.delete.success',
      messageKey: 'dashboards.delete.success'
    })
    expect(event.statusCode).toBe(200)
  })

  it.each([
    ['confirmation_mismatch', 409, 'dashboards.delete.errors.confirmationMismatch'],
    ['not_found', 404, 'dashboards.delete.errors.notFound'],
    ['persistence_unavailable', 503, 'dashboards.delete.errors.persistenceUnavailable'],
    ['unexpected_error', 500, 'dashboards.delete.errors.unexpected']
  ])(
    'maps service error %s to the correct status and message key',
    async (code, status, messageKey) => {
      readBodyMock.mockResolvedValue({})
      validateDeleteDashboardInputMock.mockReturnValue({
        ok: true,
        data: {
          dashboardId: 'dashboard-1',
          confirmationName: 'Executive overview'
        }
      })
      deleteDashboardMock.mockResolvedValue({
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
    validateDeleteDashboardInputMock.mockReturnValue({
      ok: true,
      data: {
        dashboardId: 'dashboard-1',
        confirmationName: 'Executive overview'
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
      message: 'dashboards.delete.errors.forbidden',
      messageKey: 'dashboards.delete.errors.forbidden'
    })
    expect(event.statusCode).toBe(403)
  })

  it('returns unexpected_error when deleting throws unexpectedly', async () => {
    readBodyMock.mockResolvedValue({})
    validateDeleteDashboardInputMock.mockReturnValue({
      ok: true,
      data: {
        dashboardId: 'dashboard-1',
        confirmationName: 'Executive overview'
      }
    })
    deleteDashboardMock.mockRejectedValue(new Error('boom'))
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
      message: 'dashboards.delete.errors.unexpected',
      messageKey: 'dashboards.delete.errors.unexpected'
    })
    expect(event.statusCode).toBe(500)
    expect(consoleErrorSpy).toHaveBeenCalled()

    consoleErrorSpy.mockRestore()
  })
})

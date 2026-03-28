import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const getAuthenticatedOrganizationContextMock = vi.fn()
const validateCreateDashboardInputMock = vi.fn()
const createDashboardMock = vi.fn()
const readBodyMock = vi.fn()
const setResponseStatusMock = vi.fn((event: Record<string, unknown>, status: number) => {
  event.statusCode = status
})

vi.mock('../../../../server/utils/auth-organization', () => ({
  getAuthenticatedOrganizationContext: getAuthenticatedOrganizationContextMock
}))

vi.mock('../../../../server/validators/dashboards', () => ({
  validateCreateDashboardInput: validateCreateDashboardInputMock
}))

vi.mock('../../../../server/services/dashboards', () => ({
  createDashboard: createDashboardMock
}))

const loadHandler = async () => {
  vi.resetModules()
  vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
  vi.stubGlobal('readBody', readBodyMock)
  vi.stubGlobal('setResponseStatus', setResponseStatusMock)

  return (await import('../../../../server/api/dashboards/index.post')).default as (
    event: Record<string, unknown>
  ) => Promise<unknown>
}

describe('POST /api/dashboards', () => {
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
    const event: Record<string, unknown> = {}

    await expect(handler(event)).resolves.toEqual({
      ok: false,
      code: 'invalid_input',
      issue: 'body_invalid',
      field: 'body',
      message: 'dashboards.create.errors.bodyInvalid',
      messageKey: 'dashboards.create.errors.bodyInvalid'
    })
    expect(event.statusCode).toBe(400)
    expect(validateCreateDashboardInputMock).not.toHaveBeenCalled()
    expect(createDashboardMock).not.toHaveBeenCalled()
  })

  it('returns validator failures with the expected i18n key', async () => {
    readBodyMock.mockResolvedValue({})
    validateCreateDashboardInputMock.mockReturnValue({
      ok: false,
      code: 'invalid_input',
      issue: 'dashboard_name_required',
      field: 'dashboardName',
      message: 'dashboard_name_required'
    })

    const handler = await loadHandler()
    const event: Record<string, unknown> = {}

    await expect(handler(event)).resolves.toEqual({
      ok: false,
      code: 'invalid_input',
      issue: 'dashboard_name_required',
      field: 'dashboardName',
      message: 'dashboards.create.errors.dashboardNameRequired',
      messageKey: 'dashboards.create.errors.dashboardNameRequired'
    })
    expect(event.statusCode).toBe(400)
  })

  it('returns success when a dashboard is created', async () => {
    const validatedInput = {
      dashboardName: 'Executive overview'
    }

    readBodyMock.mockResolvedValue(validatedInput)
    validateCreateDashboardInputMock.mockReturnValue({
      ok: true,
      data: validatedInput
    })
    createDashboardMock.mockResolvedValue({
      ok: true,
      code: 'success',
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

    const handler = await loadHandler()
    const event: Record<string, unknown> = {}

    await expect(handler(event)).resolves.toEqual({
      ok: true,
      code: 'success',
      message: 'dashboards.create.success',
      messageKey: 'dashboards.create.success',
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
    expect(event.statusCode).toBe(201)
  })

  it.each([
    ['duplicate_dashboard_name', 409, 'dashboards.create.errors.duplicateDashboardName'],
    ['persistence_unavailable', 503, 'dashboards.create.errors.persistenceUnavailable'],
    ['unexpected_error', 500, 'dashboards.create.errors.unexpected']
  ])(
    'maps service error %s to the correct status and message key',
    async (code, status, messageKey) => {
      readBodyMock.mockResolvedValue({})
      validateCreateDashboardInputMock.mockReturnValue({
        ok: true,
        data: {
          dashboardName: 'Executive overview'
        }
      })
      createDashboardMock.mockResolvedValue({
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
    readBodyMock.mockResolvedValue({})
    validateCreateDashboardInputMock.mockReturnValue({
      ok: true,
      data: {
        dashboardName: 'Executive overview'
      }
    })
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
      message: 'dashboards.create.errors.forbidden',
      messageKey: 'dashboards.create.errors.forbidden'
    })
    expect(event.statusCode).toBe(403)
  })

  it('returns unexpected_error when dashboard creation throws unexpectedly', async () => {
    readBodyMock.mockResolvedValue({})
    validateCreateDashboardInputMock.mockReturnValue({
      ok: true,
      data: {
        dashboardName: 'Executive overview'
      }
    })
    createDashboardMock.mockRejectedValue(new Error('boom'))
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const handler = await loadHandler()
    const event: Record<string, unknown> = {}

    await expect(handler(event)).resolves.toEqual({
      ok: false,
      code: 'unexpected_error',
      message: 'dashboards.create.errors.unexpected',
      messageKey: 'dashboards.create.errors.unexpected'
    })
    expect(event.statusCode).toBe(500)
    expect(consoleErrorSpy).toHaveBeenCalled()

    consoleErrorSpy.mockRestore()
  })
})

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const getAuthenticatedOrganizationContextMock = vi.fn()
const listSavedDatabaseConnectionsMock = vi.fn()
const setResponseStatusMock = vi.fn((event: Record<string, unknown>, status: number) => {
  event.statusCode = status
})

vi.mock('../../../../server/utils/auth-organization', () => ({
  getAuthenticatedOrganizationContext: getAuthenticatedOrganizationContextMock
}))

vi.mock('../../../../server/services/database-connections', () => ({
  listSavedDatabaseConnections: listSavedDatabaseConnectionsMock
}))

const loadHandler = async () => {
  vi.resetModules()
  vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
  vi.stubGlobal('setResponseStatus', setResponseStatusMock)

  return (await import('../../../../server/api/connections/index.get')).default as (
    event: Record<string, unknown>
  ) => Promise<unknown>
}

describe('GET /api/connections', () => {
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

  it('returns saved connections for the current organization', async () => {
    listSavedDatabaseConnectionsMock.mockResolvedValue({
      ok: true,
      code: 'success',
      connections: [{
        id: 'connection-1',
        connectionName: 'Primary',
        databaseType: 'postgresql',
        createdAt: '2026-03-18T00:00:00.000Z',
        updatedAt: '2026-03-18T00:00:00.000Z'
      }]
    })

    const handler = await loadHandler()
    const event: Record<string, unknown> = {}

    await expect(handler(event)).resolves.toEqual({
      ok: true,
      code: 'success',
      message: 'connections.list.success',
      messageKey: 'connections.list.success',
      connections: [{
        id: 'connection-1',
        connectionName: 'Primary',
        databaseType: 'postgresql',
        createdAt: '2026-03-18T00:00:00.000Z',
        updatedAt: '2026-03-18T00:00:00.000Z'
      }]
    })
    expect(event.statusCode).toBe(200)
  })

  it('returns forbidden when the tenant context is missing', async () => {
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
      message: 'connections.list.errors.forbidden',
      messageKey: 'connections.list.errors.forbidden'
    })
    expect(event.statusCode).toBe(403)
  })

  it('returns unexpected_error when the service throws unexpectedly', async () => {
    listSavedDatabaseConnectionsMock.mockRejectedValue(new Error('boom'))
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const handler = await loadHandler()
    const event: Record<string, unknown> = {}

    await expect(handler(event)).resolves.toEqual({
      ok: false,
      code: 'unexpected_error',
      message: 'connections.list.errors.unexpected',
      messageKey: 'connections.list.errors.unexpected'
    })
    expect(event.statusCode).toBe(500)
    expect(consoleErrorSpy).toHaveBeenCalled()

    consoleErrorSpy.mockRestore()
  })

  it.each([
    ['persistence_unavailable', 503, 'connections.list.errors.persistenceUnavailable'],
    ['unexpected_error', 500, 'connections.list.errors.unexpected']
  ])(
    'maps service error %s to the correct status and i18n key',
    async (code, status, messageKey) => {
      listSavedDatabaseConnectionsMock.mockResolvedValue({
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
})

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const validateSavedDatabaseConnectionIdMock = vi.fn()
const getAuthenticatedOrganizationContextMock = vi.fn()
const getSavedDatabaseConnectionMock = vi.fn()
const getRouterParamMock = vi.fn()
const setResponseStatusMock = vi.fn((event: Record<string, unknown>, status: number) => {
  event.statusCode = status
})

vi.mock('../../../../server/validators/database-connections', () => ({
  validateSavedDatabaseConnectionId: validateSavedDatabaseConnectionIdMock
}))

vi.mock('../../../../server/utils/auth-organization', () => ({
  getAuthenticatedOrganizationContext: getAuthenticatedOrganizationContextMock
}))

vi.mock('../../../../server/services/database-connections', () => ({
  getSavedDatabaseConnection: getSavedDatabaseConnectionMock
}))

const loadHandler = async () => {
  vi.resetModules()
  vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
  vi.stubGlobal('getRouterParam', getRouterParamMock)
  vi.stubGlobal('setResponseStatus', setResponseStatusMock)

  return (await import('../../../../server/api/connections/[connectionId].get')).default as (
    event: Record<string, unknown>
  ) => Promise<unknown>
}

describe('GET /api/connections/:connectionId', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getRouterParamMock.mockReturnValue('2f8f9425-55cf-4d8e-a446-638848de1942')
    getAuthenticatedOrganizationContextMock.mockReturnValue({
      userId: 'user-1',
      organizationId: 'org-1',
      organizationName: 'ACME'
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns a validation error when the connection id is invalid', async () => {
    validateSavedDatabaseConnectionIdMock.mockReturnValue({
      ok: false,
      code: 'invalid_input',
      issue: 'connection_id_invalid',
      field: 'connectionId',
      message: 'connection_id_invalid'
    })

    const handler = await loadHandler()
    const event: Record<string, unknown> = {}

    await expect(handler(event)).resolves.toEqual({
      ok: false,
      code: 'invalid_input',
      issue: 'connection_id_invalid',
      field: 'connectionId',
      message: 'connections.edit.errors.connectionIdInvalid',
      messageKey: 'connections.edit.errors.connectionIdInvalid'
    })
    expect(event.statusCode).toBe(400)
    expect(getSavedDatabaseConnectionMock).not.toHaveBeenCalled()
  })

  it('returns the saved connection details', async () => {
    validateSavedDatabaseConnectionIdMock.mockReturnValue({
      ok: true,
      data: {
        connectionId: '2f8f9425-55cf-4d8e-a446-638848de1942'
      }
    })
    getSavedDatabaseConnectionMock.mockResolvedValue({
      ok: true,
      code: 'success',
      connection: {
        id: 'connection-1',
        connectionName: 'Primary',
        databaseType: 'postgresql',
        host: 'db.internal',
        port: 5432,
        databaseName: 'app_db',
        username: 'app_user',
        sslMode: 'disable',
        hasPassword: true
      }
    })

    const handler = await loadHandler()
    const event: Record<string, unknown> = {}

    await expect(handler(event)).resolves.toEqual({
      ok: true,
      code: 'success',
      message: 'connections.edit.success',
      messageKey: 'connections.edit.success',
      connection: {
        id: 'connection-1',
        connectionName: 'Primary',
        databaseType: 'postgresql',
        host: 'db.internal',
        port: 5432,
        databaseName: 'app_db',
        username: 'app_user',
        sslMode: 'disable',
        hasPassword: true
      }
    })
    expect(event.statusCode).toBe(200)
  })

  it('returns forbidden when the tenant context is missing', async () => {
    validateSavedDatabaseConnectionIdMock.mockReturnValue({
      ok: true,
      data: {
        connectionId: '2f8f9425-55cf-4d8e-a446-638848de1942'
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
      message: 'connections.edit.errors.forbidden',
      messageKey: 'connections.edit.errors.forbidden'
    })
    expect(event.statusCode).toBe(403)
  })

  it.each([
    ['not_found', 404, 'connections.edit.errors.notFound'],
    ['persistence_unavailable', 503, 'connections.edit.errors.persistenceUnavailable'],
    ['unexpected_error', 500, 'connections.edit.errors.unexpected']
  ])(
    'maps service error %s to the correct status and message key',
    async (code, status, messageKey) => {
      validateSavedDatabaseConnectionIdMock.mockReturnValue({
        ok: true,
        data: {
          connectionId: '2f8f9425-55cf-4d8e-a446-638848de1942'
        }
      })
      getSavedDatabaseConnectionMock.mockResolvedValue({
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

  it('returns unexpected_error when loading throws unexpectedly', async () => {
    validateSavedDatabaseConnectionIdMock.mockReturnValue({
      ok: true,
      data: {
        connectionId: '2f8f9425-55cf-4d8e-a446-638848de1942'
      }
    })
    getSavedDatabaseConnectionMock.mockRejectedValue(new Error('boom'))
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const handler = await loadHandler()
    const event: Record<string, unknown> = {}

    await expect(handler(event)).resolves.toEqual({
      ok: false,
      code: 'unexpected_error',
      message: 'connections.edit.errors.unexpected',
      messageKey: 'connections.edit.errors.unexpected'
    })
    expect(event.statusCode).toBe(500)
    expect(consoleErrorSpy).toHaveBeenCalled()

    consoleErrorSpy.mockRestore()
  })
})

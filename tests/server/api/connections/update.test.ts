import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const validateUpdateDatabaseConnectionInputMock = vi.fn()
const getAuthenticatedOrganizationContextMock = vi.fn()
const updateDatabaseConnectionMock = vi.fn()
const readBodyMock = vi.fn()
const getRouterParamMock = vi.fn()
const setResponseStatusMock = vi.fn((event: Record<string, unknown>, status: number) => {
  event.statusCode = status
})

vi.mock('../../../../server/validators/database-connections', () => ({
  validateUpdateDatabaseConnectionInput: validateUpdateDatabaseConnectionInputMock
}))

vi.mock('../../../../server/utils/auth-organization', () => ({
  getAuthenticatedOrganizationContext: getAuthenticatedOrganizationContextMock
}))

vi.mock('../../../../server/services/database-connections', () => ({
  updateDatabaseConnection: updateDatabaseConnectionMock
}))

const loadHandler = async () => {
  vi.resetModules()
  vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
  vi.stubGlobal('readBody', readBodyMock)
  vi.stubGlobal('getRouterParam', getRouterParamMock)
  vi.stubGlobal('setResponseStatus', setResponseStatusMock)

  return (await import('../../../../server/api/connections/[connectionId].put')).default as (
    event: Record<string, unknown>
  ) => Promise<unknown>
}

describe('PUT /api/connections/:connectionId', () => {
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

  it('returns a validation error when the request body is invalid JSON', async () => {
    readBodyMock.mockRejectedValue(new Error('bad json'))

    const handler = await loadHandler()
    const event: Record<string, unknown> = {}

    await expect(handler(event)).resolves.toEqual({
      ok: false,
      code: 'invalid_input',
      issue: 'body_invalid',
      field: 'body',
      message: 'connections.update.errors.bodyInvalid',
      messageKey: 'connections.update.errors.bodyInvalid'
    })
    expect(event.statusCode).toBe(400)
    expect(validateUpdateDatabaseConnectionInputMock).not.toHaveBeenCalled()
    expect(updateDatabaseConnectionMock).not.toHaveBeenCalled()
  })

  it('returns validator failures with the expected i18n key', async () => {
    readBodyMock.mockResolvedValue({})
    validateUpdateDatabaseConnectionInputMock.mockReturnValue({
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
      message: 'connections.update.errors.connectionIdInvalid',
      messageKey: 'connections.update.errors.connectionIdInvalid'
    })
    expect(event.statusCode).toBe(400)
  })

  it('returns forbidden when the tenant context is missing', async () => {
    readBodyMock.mockResolvedValue({})
    validateUpdateDatabaseConnectionInputMock.mockReturnValue({
      ok: true,
      data: {
        connectionId: '2f8f9425-55cf-4d8e-a446-638848de1942',
        connectionName: 'Primary'
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
      message: 'connections.update.errors.forbidden',
      messageKey: 'connections.update.errors.forbidden'
    })
    expect(event.statusCode).toBe(403)
  })

  it('returns success when a connection is updated', async () => {
    const validatedInput = {
      connectionId: '2f8f9425-55cf-4d8e-a446-638848de1942',
      connectionName: 'Primary',
      databaseType: 'postgresql',
      host: 'db.internal',
      port: 5432,
      databaseName: 'app_db',
      username: 'app_user',
      password: undefined,
      sslMode: 'disable'
    }

    readBodyMock.mockResolvedValue(validatedInput)
    validateUpdateDatabaseConnectionInputMock.mockReturnValue({
      ok: true,
      data: validatedInput
    })
    updateDatabaseConnectionMock.mockResolvedValue({
      ok: true,
      code: 'success',
      connection: {
        id: 'connection-1',
        connectionName: 'Primary',
        databaseType: 'postgresql',
        createdAt: '2026-03-18T00:00:00.000Z',
        updatedAt: '2026-03-18T01:00:00.000Z'
      }
    })

    const handler = await loadHandler()
    const event: Record<string, unknown> = {}

    await expect(handler(event)).resolves.toEqual({
      ok: true,
      code: 'success',
      message: 'connections.update.success',
      messageKey: 'connections.update.success',
      connection: {
        id: 'connection-1',
        connectionName: 'Primary',
        databaseType: 'postgresql',
        createdAt: '2026-03-18T00:00:00.000Z',
        updatedAt: '2026-03-18T01:00:00.000Z'
      }
    })
    expect(event.statusCode).toBe(200)
  })

  it.each([
    ['not_found', 404, 'connections.update.errors.notFound'],
    ['duplicate_connection_name', 409, 'connections.update.errors.duplicateConnectionName'],
    ['duplicate_connection_target', 409, 'connections.update.errors.duplicateConnectionTarget'],
    ['persistence_unavailable', 503, 'connections.update.errors.persistenceUnavailable'],
    ['unexpected_error', 500, 'connections.update.errors.unexpected']
  ])(
    'maps service error %s to the correct status and message key',
    async (code, status, messageKey) => {
      readBodyMock.mockResolvedValue({})
      validateUpdateDatabaseConnectionInputMock.mockReturnValue({
        ok: true,
        data: {
          connectionId: '2f8f9425-55cf-4d8e-a446-638848de1942',
          connectionName: 'Primary'
        }
      })
      updateDatabaseConnectionMock.mockResolvedValue({
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

  it('returns unexpected_error when updating throws unexpectedly', async () => {
    readBodyMock.mockResolvedValue({})
    validateUpdateDatabaseConnectionInputMock.mockReturnValue({
      ok: true,
      data: {
        connectionId: '2f8f9425-55cf-4d8e-a446-638848de1942',
        connectionName: 'Primary'
      }
    })
    updateDatabaseConnectionMock.mockRejectedValue(new Error('boom'))
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const handler = await loadHandler()
    const event: Record<string, unknown> = {}

    await expect(handler(event)).resolves.toEqual({
      ok: false,
      code: 'unexpected_error',
      message: 'connections.update.errors.unexpected',
      messageKey: 'connections.update.errors.unexpected'
    })
    expect(event.statusCode).toBe(500)
    expect(consoleErrorSpy).toHaveBeenCalled()

    consoleErrorSpy.mockRestore()
  })
})

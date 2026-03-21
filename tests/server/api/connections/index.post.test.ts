import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const validateSaveDatabaseConnectionInputMock = vi.fn()
const getAuthenticatedOrganizationContextMock = vi.fn()
const saveDatabaseConnectionMock = vi.fn()
const readBodyMock = vi.fn()
const setResponseStatusMock = vi.fn((event: Record<string, unknown>, status: number) => {
  event.statusCode = status
})

vi.mock('../../../../server/validators/database-connections', () => ({
  validateSaveDatabaseConnectionInput: validateSaveDatabaseConnectionInputMock
}))

vi.mock('../../../../server/utils/auth-organization', () => ({
  getAuthenticatedOrganizationContext: getAuthenticatedOrganizationContextMock
}))

vi.mock('../../../../server/services/database-connections', () => ({
  saveDatabaseConnection: saveDatabaseConnectionMock
}))

const loadHandler = async () => {
  vi.resetModules()
  vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
  vi.stubGlobal('readBody', readBodyMock)
  vi.stubGlobal('setResponseStatus', setResponseStatusMock)

  return (await import('../../../../server/api/connections/index.post')).default as (
    event: Record<string, unknown>
  ) => Promise<unknown>
}

describe('POST /api/connections', () => {
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
      message: 'connections.save.errors.bodyInvalid',
      messageKey: 'connections.save.errors.bodyInvalid'
    })
    expect(event.statusCode).toBe(400)
    expect(validateSaveDatabaseConnectionInputMock).not.toHaveBeenCalled()
    expect(saveDatabaseConnectionMock).not.toHaveBeenCalled()
  })

  it('returns validation errors with the expected i18n key', async () => {
    readBodyMock.mockResolvedValue({})
    validateSaveDatabaseConnectionInputMock.mockReturnValue({
      ok: false,
      code: 'invalid_input',
      issue: 'connection_name_required',
      field: 'connectionName',
      message: 'connection_name_required'
    })

    const handler = await loadHandler()
    const event: Record<string, unknown> = {}

    await expect(handler(event)).resolves.toEqual({
      ok: false,
      code: 'invalid_input',
      issue: 'connection_name_required',
      field: 'connectionName',
      message: 'connections.save.errors.connectionNameRequired',
      messageKey: 'connections.save.errors.connectionNameRequired'
    })
    expect(event.statusCode).toBe(400)
  })

  it('returns a forbidden response when the tenant context is missing', async () => {
    readBodyMock.mockResolvedValue({})
    validateSaveDatabaseConnectionInputMock.mockReturnValue({
      ok: true,
      data: { connectionName: 'Primary' }
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
      message: 'connections.save.errors.forbidden',
      messageKey: 'connections.save.errors.forbidden'
    })
    expect(event.statusCode).toBe(403)
  })

  it('returns unexpected_error when saving throws unexpectedly', async () => {
    readBodyMock.mockResolvedValue({})
    validateSaveDatabaseConnectionInputMock.mockReturnValue({
      ok: true,
      data: { connectionName: 'Primary' }
    })
    saveDatabaseConnectionMock.mockRejectedValue(new Error('boom'))
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const handler = await loadHandler()
    const event: Record<string, unknown> = {}

    await expect(handler(event)).resolves.toEqual({
      ok: false,
      code: 'unexpected_error',
      message: 'connections.save.errors.unexpected',
      messageKey: 'connections.save.errors.unexpected'
    })
    expect(event.statusCode).toBe(500)
    expect(consoleErrorSpy).toHaveBeenCalled()

    consoleErrorSpy.mockRestore()
  })

  it('returns created responses when a connection is saved', async () => {
    const validatedInput = {
      connectionName: 'Primary',
      databaseType: 'postgresql',
      host: 'db.internal',
      port: 5432,
      databaseName: 'app_db',
      username: 'app_user',
      password: 'secret',
      sslMode: 'disable'
    }

    readBodyMock.mockResolvedValue(validatedInput)
    validateSaveDatabaseConnectionInputMock.mockReturnValue({
      ok: true,
      data: validatedInput
    })
    saveDatabaseConnectionMock.mockResolvedValue({
      ok: true,
      code: 'success',
      connection: {
        id: 'connection-1',
        connectionName: 'Primary',
        databaseType: 'postgresql',
        createdAt: '2026-03-18T00:00:00.000Z',
        updatedAt: '2026-03-18T00:00:00.000Z'
      }
    })

    const handler = await loadHandler()
    const event: Record<string, unknown> = {}

    await expect(handler(event)).resolves.toEqual({
      ok: true,
      code: 'success',
      message: 'connections.save.success',
      messageKey: 'connections.save.success',
      connection: {
        id: 'connection-1',
        connectionName: 'Primary',
        databaseType: 'postgresql',
        createdAt: '2026-03-18T00:00:00.000Z',
        updatedAt: '2026-03-18T00:00:00.000Z'
      }
    })
    expect(event.statusCode).toBe(201)
  })

  it.each([
    ['duplicate_connection_name', 409, 'connections.save.errors.duplicateConnectionName'],
    ['duplicate_connection_target', 409, 'connections.save.errors.duplicateConnectionTarget'],
    ['persistence_unavailable', 503, 'connections.save.errors.persistenceUnavailable'],
    ['unexpected_error', 500, 'connections.save.errors.unexpected']
  ])(
    'maps service error %s to the correct status and message key',
    async (code, status, messageKey) => {
      readBodyMock.mockResolvedValue({})
      validateSaveDatabaseConnectionInputMock.mockReturnValue({
        ok: true,
        data: { connectionName: 'Primary' }
      })
      saveDatabaseConnectionMock.mockResolvedValue({
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

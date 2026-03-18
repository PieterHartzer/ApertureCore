import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const validateTestDatabaseConnectionInputMock = vi.fn()
const testDatabaseConnectionMock = vi.fn()
const consumeConnectionTestRateLimitMock = vi.fn()
const readBodyMock = vi.fn()
const setResponseStatusMock = vi.fn((event: Record<string, unknown>, status: number) => {
  event.statusCode = status
})
const setResponseHeaderMock = vi.fn((event: Record<string, unknown>, name: string, value: string) => {
  event.headers = {
    ...(event.headers as Record<string, string> | undefined),
    [name]: value
  }
})

vi.mock('../../../../server/validators/database', () => ({
  validateTestDatabaseConnectionInput: validateTestDatabaseConnectionInputMock,
}))

vi.mock('../../../../server/services/database/index', () => ({
  testDatabaseConnection: testDatabaseConnectionMock,
}))

vi.mock('../../../../server/utils/database-connection-test-rate-limit', () => ({
  consumeConnectionTestRateLimit: consumeConnectionTestRateLimitMock,
}))

const loadHandler = async () => {
  vi.resetModules()
  vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
  vi.stubGlobal('readBody', readBodyMock)
  vi.stubGlobal('setResponseStatus', setResponseStatusMock)
  vi.stubGlobal('setResponseHeader', setResponseHeaderMock)

  return (await import('../../../../server/api/connections/test.post')).default as (
    event: Record<string, unknown>
  ) => Promise<unknown>
}

describe('POST /api/connections/test', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    consumeConnectionTestRateLimitMock.mockResolvedValue({
      allowed: true,
      limit: 5,
      remaining: 4,
      resetAt: Date.now() + 60_000,
      retryAfterSeconds: 0
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
      message: 'connections.test.errors.bodyInvalid',
      messageKey: 'connections.test.errors.bodyInvalid',
    })
    expect(event.statusCode).toBe(400)
    expect(validateTestDatabaseConnectionInputMock).not.toHaveBeenCalled()
    expect(testDatabaseConnectionMock).not.toHaveBeenCalled()
  })

  it('returns a rate-limited response when the user has exceeded the allowed test attempts', async () => {
    consumeConnectionTestRateLimitMock.mockResolvedValue({
      allowed: false,
      limit: 5,
      remaining: 0,
      resetAt: Date.now() + 30_000,
      retryAfterSeconds: 30
    })

    const handler = await loadHandler()
    const event: Record<string, unknown> = {}

    await expect(handler(event)).resolves.toEqual({
      ok: false,
      code: 'rate_limited',
      message: 'connections.test.errors.rateLimited',
      messageKey: 'connections.test.errors.rateLimited',
    })
    expect(event.statusCode).toBe(429)
    expect(event.headers).toEqual({
      'retry-after': '30'
    })
    expect(readBodyMock).not.toHaveBeenCalled()
    expect(validateTestDatabaseConnectionInputMock).not.toHaveBeenCalled()
    expect(testDatabaseConnectionMock).not.toHaveBeenCalled()
  })

  it('returns validator failures with the mapped i18n key', async () => {
    readBodyMock.mockResolvedValue({})
    validateTestDatabaseConnectionInputMock.mockReturnValue({
      ok: false,
      code: 'invalid_input',
      issue: 'host_required',
      field: 'host',
      message: 'host_required',
    })

    const handler = await loadHandler()
    const event: Record<string, unknown> = {}

    await expect(handler(event)).resolves.toEqual({
      ok: false,
      code: 'invalid_input',
      issue: 'host_required',
      field: 'host',
      message: 'connections.test.errors.hostRequired',
      messageKey: 'connections.test.errors.hostRequired',
    })
    expect(event.statusCode).toBe(400)
    expect(testDatabaseConnectionMock).not.toHaveBeenCalled()
  })

  it('returns success responses unchanged', async () => {
    const validatedInput = {
      connectionName: 'Primary',
      databaseType: 'postgresql',
      host: 'db.internal',
      port: 5432,
      databaseName: 'app_db',
      username: 'admin',
      password: 'secret',
      sslMode: 'disable',
    }

    readBodyMock.mockResolvedValue(validatedInput)
    validateTestDatabaseConnectionInputMock.mockReturnValue({
      ok: true,
      data: validatedInput,
    })
    testDatabaseConnectionMock.mockResolvedValue({
      ok: true,
      code: 'success',
      message: 'success',
    })

    const handler = await loadHandler()
    const event: Record<string, unknown> = {}

    await expect(handler(event)).resolves.toEqual({
      ok: true,
      code: 'success',
      message: 'connections.test.success',
      messageKey: 'connections.test.success',
    })
    expect(event.statusCode).toBe(200)
  })

  it.each([
    [
      'rate_limited',
      429,
      'connections.test.errors.rateLimited',
    ],
    [
      'invalid_input',
      400,
      'connections.test.errors.invalidInput',
    ],
    [
      'unsupported_database_type',
      400,
      'connections.test.errors.unsupportedDatabaseType',
    ],
    [
      'authentication_failed',
      401,
      'connections.test.errors.authenticationFailed',
    ],
    [
      'database_not_found',
      404,
      'connections.test.errors.databaseNotFound',
    ],
    [
      'ssl_required',
      400,
      'connections.test.errors.sslRequired',
    ],
    [
      'timeout',
      504,
      'connections.test.errors.timeout',
    ],
    [
      'connection_failed',
      503,
      'connections.test.errors.connectionFailed',
    ],
    [
      'not_implemented',
      501,
      'connections.test.errors.notImplemented',
    ],
    [
      'unexpected_error',
      500,
      'connections.test.errors.unexpected',
    ],
  ])(
    'maps service result %s to the correct status and i18n key',
    async (code, status, messageKey) => {
      const validatedInput = {
        connectionName: 'Primary',
        databaseType: 'postgresql',
        host: 'db.internal',
        port: 5432,
        databaseName: 'app_db',
        username: 'admin',
        password: 'secret',
        sslMode: 'disable',
      }

      readBodyMock.mockResolvedValue(validatedInput)
      validateTestDatabaseConnectionInputMock.mockReturnValue({
        ok: true,
        data: validatedInput,
      })
      testDatabaseConnectionMock.mockResolvedValue({
        ok: false,
        code,
        message: code,
        details: 'More detail',
      })

      const handler = await loadHandler()
      const event: Record<string, unknown> = {}

      await expect(handler(event)).resolves.toEqual({
        ok: false,
        code,
        message: messageKey,
        messageKey,
      })
      expect(event.statusCode).toBe(status)
    }
  )

  it('returns an unexpected error response when the service throws', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const validatedInput = {
      connectionName: 'Primary',
      databaseType: 'postgresql',
      host: 'db.internal',
      port: 5432,
      databaseName: 'app_db',
      username: 'admin',
      password: 'secret',
      sslMode: 'disable',
    }

    readBodyMock.mockResolvedValue(validatedInput)
    validateTestDatabaseConnectionInputMock.mockReturnValue({
      ok: true,
      data: validatedInput,
    })
    testDatabaseConnectionMock.mockRejectedValue(new Error('boom'))

    const handler = await loadHandler()
    const event: Record<string, unknown> = {}

    await expect(handler(event)).resolves.toEqual({
      ok: false,
      code: 'unexpected_error',
      message: 'connections.test.errors.unexpected',
      messageKey: 'connections.test.errors.unexpected',
    })
    expect(event.statusCode).toBe(500)
    expect(consoleErrorSpy).toHaveBeenCalled()
  })

  it('stringifies non-Error throw values from the service', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const validatedInput = {
      connectionName: 'Primary',
      databaseType: 'postgresql',
      host: 'db.internal',
      port: 5432,
      databaseName: 'app_db',
      username: 'admin',
      password: 'secret',
      sslMode: 'disable',
    }

    readBodyMock.mockResolvedValue(validatedInput)
    validateTestDatabaseConnectionInputMock.mockReturnValue({
      ok: true,
      data: validatedInput,
    })
    testDatabaseConnectionMock.mockRejectedValue('boom')

    const handler = await loadHandler()
    const event: Record<string, unknown> = {}

    await expect(handler(event)).resolves.toEqual({
      ok: false,
      code: 'unexpected_error',
      message: 'connections.test.errors.unexpected',
      messageKey: 'connections.test.errors.unexpected',
    })
    expect(event.statusCode).toBe(500)
    expect(consoleErrorSpy).toHaveBeenCalled()
  })
})

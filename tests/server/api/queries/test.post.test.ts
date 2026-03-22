import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const validateTestSavedSqlQueryInputMock = vi.fn()
const testSavedSqlQueryMock = vi.fn()
const consumeSavedSqlQueryTestRateLimitMock = vi.fn()
const getAuthenticatedOrganizationContextMock = vi.fn()
const readBodyMock = vi.fn()
const setResponseStatusMock = vi.fn((event: Record<string, unknown>, status: number) => {
  event.statusCode = status
})
const setResponseHeaderMock = vi.fn((event: Record<string, unknown>, name: string, value: string | number) => {
  event.headers = {
    ...(event.headers as Record<string, string> | undefined),
    [name]: String(value)
  }
})

vi.mock('../../../../server/validators/saved-sql-queries', () => ({
  validateTestSavedSqlQueryInput: validateTestSavedSqlQueryInputMock,
}))

vi.mock('../../../../server/services/saved-sql-queries', () => ({
  testSavedSqlQuery: testSavedSqlQueryMock,
}))

vi.mock('../../../../server/utils/saved-sql-query-test-rate-limit', () => ({
  consumeSavedSqlQueryTestRateLimit: consumeSavedSqlQueryTestRateLimitMock,
}))

vi.mock('../../../../server/utils/auth-organization', () => ({
  getAuthenticatedOrganizationContext: getAuthenticatedOrganizationContextMock,
}))

const loadHandler = async () => {
  vi.resetModules()
  vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
  vi.stubGlobal('readBody', readBodyMock)
  vi.stubGlobal('setResponseStatus', setResponseStatusMock)
  vi.stubGlobal('setResponseHeader', setResponseHeaderMock)

  return (await import('../../../../server/api/queries/test.post')).default as (
    event: Record<string, unknown>
  ) => Promise<unknown>
}

describe('POST /api/queries/test', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    consumeSavedSqlQueryTestRateLimitMock.mockResolvedValue({
      allowed: true,
      limit: 5,
      remaining: 4,
      resetAt: Date.now() + 60_000,
      retryAfterSeconds: 0
    })
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
      message: 'queries.test.errors.bodyInvalid',
      messageKey: 'queries.test.errors.bodyInvalid',
    })
    expect(event.statusCode).toBe(400)
    expect(validateTestSavedSqlQueryInputMock).not.toHaveBeenCalled()
    expect(testSavedSqlQueryMock).not.toHaveBeenCalled()
  })

  it('returns a rate-limited response when the user has exceeded the allowed query tests', async () => {
    consumeSavedSqlQueryTestRateLimitMock.mockResolvedValue({
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
      message: 'queries.test.errors.rateLimited',
      messageKey: 'queries.test.errors.rateLimited',
    })
    expect(event.statusCode).toBe(429)
    expect(event.headers).toEqual({
      'retry-after': '30'
    })
    expect(readBodyMock).not.toHaveBeenCalled()
    expect(validateTestSavedSqlQueryInputMock).not.toHaveBeenCalled()
    expect(testSavedSqlQueryMock).not.toHaveBeenCalled()
  })

  it('returns validator failures with the mapped i18n key', async () => {
    readBodyMock.mockResolvedValue({})
    validateTestSavedSqlQueryInputMock.mockReturnValue({
      ok: false,
      code: 'invalid_input',
      issue: 'sql_required',
      field: 'sql',
      message: 'sql_required',
    })

    const handler = await loadHandler()
    const event: Record<string, unknown> = {}

    await expect(handler(event)).resolves.toEqual({
      ok: false,
      code: 'invalid_input',
      issue: 'sql_required',
      field: 'sql',
      message: 'queries.test.errors.sqlRequired',
      messageKey: 'queries.test.errors.sqlRequired',
    })
    expect(event.statusCode).toBe(400)
    expect(testSavedSqlQueryMock).not.toHaveBeenCalled()
  })

  it('returns successful query result payloads unchanged except for the i18n message', async () => {
    readBodyMock.mockResolvedValue({
      connectionId: '2f8f9425-55cf-4d8e-a446-638848de1942',
      sql: 'select id, name from customers'
    })
    validateTestSavedSqlQueryInputMock.mockReturnValue({
      ok: true,
      data: {
        connectionId: '2f8f9425-55cf-4d8e-a446-638848de1942',
        sql: 'select id, name from customers'
      }
    })
    testSavedSqlQueryMock.mockResolvedValue({
      ok: true,
      code: 'success',
      columns: ['id', 'name'],
      rows: [{
        id: 1,
        name: 'Alice'
      }],
      rowLimit: 25
    })

    const handler = await loadHandler()
    const event: Record<string, unknown> = {}

    await expect(handler(event)).resolves.toEqual({
      ok: true,
      code: 'success',
      message: 'queries.test.success',
      messageKey: 'queries.test.success',
      columns: ['id', 'name'],
      rows: [{
        id: 1,
        name: 'Alice'
      }],
      rowLimit: 25
    })
    expect(event.statusCode).toBe(200)
  })

  it.each([
    ['saved_connection_not_found', 404, 'queries.test.errors.savedConnectionNotFound'],
    ['unsupported_database_type', 400, 'queries.test.errors.unsupportedDatabaseType'],
    ['authentication_failed', 401, 'queries.test.errors.authenticationFailed'],
    ['database_not_found', 404, 'queries.test.errors.databaseNotFound'],
    ['connection_failed', 503, 'queries.test.errors.connectionFailed'],
    ['timeout', 504, 'queries.test.errors.timeout'],
    ['ssl_required', 400, 'queries.test.errors.sslRequired'],
    ['query_rejected', 400, 'queries.test.errors.queryRejected'],
    ['query_failed', 400, 'queries.test.errors.queryFailed'],
    ['persistence_unavailable', 503, 'queries.test.errors.persistenceUnavailable'],
    ['unexpected_error', 500, 'queries.test.errors.unexpected']
  ])(
    'maps service error %s to the expected response',
    async (code, statusCode, messageKey) => {
      readBodyMock.mockResolvedValue({
        connectionId: '2f8f9425-55cf-4d8e-a446-638848de1942',
        sql: 'select 1'
      })
      validateTestSavedSqlQueryInputMock.mockReturnValue({
        ok: true,
        data: {
          connectionId: '2f8f9425-55cf-4d8e-a446-638848de1942',
          sql: 'select 1'
        }
      })
      testSavedSqlQueryMock.mockResolvedValue({
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
      expect(event.statusCode).toBe(statusCode)
    }
  )

  it('includes SQL failure details when the service provides safe query feedback', async () => {
    readBodyMock.mockResolvedValue({
      connectionId: '2f8f9425-55cf-4d8e-a446-638848de1942',
      sql: 'select * from missing_table'
    })
    validateTestSavedSqlQueryInputMock.mockReturnValue({
      ok: true,
      data: {
        connectionId: '2f8f9425-55cf-4d8e-a446-638848de1942',
        sql: 'select * from missing_table'
      }
    })
    testSavedSqlQueryMock.mockResolvedValue({
      ok: false,
      code: 'query_failed',
      message: 'query_failed',
      details: 'relation "missing_table" does not exist'
    })

    const handler = await loadHandler()
    const event: Record<string, unknown> = {}

    await expect(handler(event)).resolves.toEqual({
      ok: false,
      code: 'query_failed',
      message: 'queries.test.errors.queryFailed',
      messageKey: 'queries.test.errors.queryFailed',
      details: 'relation "missing_table" does not exist'
    })
    expect(event.statusCode).toBe(400)
  })

  it('returns forbidden when organization authentication rejects the request', async () => {
    readBodyMock.mockResolvedValue({
      connectionId: '2f8f9425-55cf-4d8e-a446-638848de1942',
      sql: 'select 1'
    })
    validateTestSavedSqlQueryInputMock.mockReturnValue({
      ok: true,
      data: {
        connectionId: '2f8f9425-55cf-4d8e-a446-638848de1942',
        sql: 'select 1'
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
      message: 'queries.test.errors.forbidden',
      messageKey: 'queries.test.errors.forbidden'
    })
    expect(event.statusCode).toBe(403)
  })

  it('returns unexpected_error when the handler throws unexpectedly', async () => {
    readBodyMock.mockResolvedValue({
      connectionId: '2f8f9425-55cf-4d8e-a446-638848de1942',
      sql: 'select 1'
    })
    validateTestSavedSqlQueryInputMock.mockReturnValue({
      ok: true,
      data: {
        connectionId: '2f8f9425-55cf-4d8e-a446-638848de1942',
        sql: 'select 1'
      }
    })
    testSavedSqlQueryMock.mockRejectedValue(new Error('boom'))
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const handler = await loadHandler()
    const event: Record<string, unknown> = {}

    await expect(handler(event)).resolves.toEqual({
      ok: false,
      code: 'unexpected_error',
      message: 'queries.test.errors.unexpected',
      messageKey: 'queries.test.errors.unexpected'
    })
    expect(event.statusCode).toBe(500)
    expect(consoleErrorSpy).toHaveBeenCalled()

    consoleErrorSpy.mockRestore()
  })
})

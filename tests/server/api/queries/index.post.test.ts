import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const validateSaveSavedSqlQueryInputMock = vi.fn()
const getAuthenticatedOrganizationContextMock = vi.fn()
const saveSavedSqlQueryMock = vi.fn()
const readBodyMock = vi.fn()
const setResponseStatusMock = vi.fn((event: Record<string, unknown>, status: number) => {
  event.statusCode = status
})

vi.mock('../../../../server/validators/saved-sql-queries', () => ({
  validateSaveSavedSqlQueryInput: validateSaveSavedSqlQueryInputMock
}))

vi.mock('../../../../server/utils/auth-organization', () => ({
  getAuthenticatedOrganizationContext: getAuthenticatedOrganizationContextMock
}))

vi.mock('../../../../server/services/saved-sql-queries', () => ({
  saveSavedSqlQuery: saveSavedSqlQueryMock
}))

const loadHandler = async () => {
  vi.resetModules()
  vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
  vi.stubGlobal('readBody', readBodyMock)
  vi.stubGlobal('setResponseStatus', setResponseStatusMock)

  return (await import('../../../../server/api/queries/index.post')).default as (
    event: Record<string, unknown>
  ) => Promise<unknown>
}

describe('POST /api/queries', () => {
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
      message: 'queries.save.errors.bodyInvalid',
      messageKey: 'queries.save.errors.bodyInvalid'
    })
    expect(event.statusCode).toBe(400)
    expect(validateSaveSavedSqlQueryInputMock).not.toHaveBeenCalled()
    expect(saveSavedSqlQueryMock).not.toHaveBeenCalled()
  })

  it('returns validation errors with the expected i18n key', async () => {
    readBodyMock.mockResolvedValue({})
    validateSaveSavedSqlQueryInputMock.mockReturnValue({
      ok: false,
      code: 'invalid_input',
      issue: 'query_name_required',
      field: 'queryName',
      message: 'query_name_required'
    })

    const handler = await loadHandler()
    const event: Record<string, unknown> = {}

    await expect(handler(event)).resolves.toEqual({
      ok: false,
      code: 'invalid_input',
      issue: 'query_name_required',
      field: 'queryName',
      message: 'queries.save.errors.queryNameRequired',
      messageKey: 'queries.save.errors.queryNameRequired'
    })
    expect(event.statusCode).toBe(400)
  })

  it.each([
    ['sql_too_long', 'queries.save.errors.sqlTooLong'],
    ['sql_invalid_characters', 'queries.save.errors.sqlInvalidCharacters'],
    ['sql_multiple_statements', 'queries.save.errors.sqlMultipleStatements'],
    ['sql_not_read_only', 'queries.save.errors.sqlNotReadOnly']
  ])(
    'maps validation issue %s to the correct i18n key',
    async (issue, messageKey) => {
      readBodyMock.mockResolvedValue({})
      validateSaveSavedSqlQueryInputMock.mockReturnValue({
        ok: false,
        code: 'invalid_input',
        issue,
        field: 'sql',
        message: issue
      })

      const handler = await loadHandler()
      const event: Record<string, unknown> = {}

      await expect(handler(event)).resolves.toEqual({
        ok: false,
        code: 'invalid_input',
        issue,
        field: 'sql',
        message: messageKey,
        messageKey
      })
      expect(event.statusCode).toBe(400)
    }
  )

  it('returns a forbidden response when the tenant context is missing', async () => {
    readBodyMock.mockResolvedValue({})
    validateSaveSavedSqlQueryInputMock.mockReturnValue({
      ok: true,
      data: { queryName: 'Top customers' }
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
      message: 'queries.save.errors.forbidden',
      messageKey: 'queries.save.errors.forbidden'
    })
    expect(event.statusCode).toBe(403)
  })

  it('returns unexpected_error when saving throws unexpectedly', async () => {
    readBodyMock.mockResolvedValue({})
    validateSaveSavedSqlQueryInputMock.mockReturnValue({
      ok: true,
      data: { queryName: 'Top customers' }
    })
    saveSavedSqlQueryMock.mockRejectedValue(new Error('boom'))
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const handler = await loadHandler()
    const event: Record<string, unknown> = {}

    await expect(handler(event)).resolves.toEqual({
      ok: false,
      code: 'unexpected_error',
      message: 'queries.save.errors.unexpected',
      messageKey: 'queries.save.errors.unexpected'
    })
    expect(event.statusCode).toBe(500)
    expect(consoleErrorSpy).toHaveBeenCalled()

    consoleErrorSpy.mockRestore()
  })

  it('returns created responses when a query is saved', async () => {
    const validatedInput = {
      queryName: 'Top customers',
      connectionId: '2f8f9425-55cf-4d8e-a446-638848de1942',
      sql: 'select * from customers'
    }

    readBodyMock.mockResolvedValue(validatedInput)
    validateSaveSavedSqlQueryInputMock.mockReturnValue({
      ok: true,
      data: validatedInput
    })
    saveSavedSqlQueryMock.mockResolvedValue({
      ok: true,
      code: 'success',
      query: {
        id: 'query-1',
        queryName: 'Top customers',
        connectionId: validatedInput.connectionId,
        connectionName: 'Primary DB',
        createdAt: '2026-03-22T00:00:00.000Z',
        updatedAt: '2026-03-22T00:00:00.000Z'
      }
    })

    const handler = await loadHandler()
    const event: Record<string, unknown> = {}

    await expect(handler(event)).resolves.toEqual({
      ok: true,
      code: 'success',
      message: 'queries.save.success',
      messageKey: 'queries.save.success',
      query: {
        id: 'query-1',
        queryName: 'Top customers',
        connectionId: validatedInput.connectionId,
        connectionName: 'Primary DB',
        createdAt: '2026-03-22T00:00:00.000Z',
        updatedAt: '2026-03-22T00:00:00.000Z'
      }
    })
    expect(event.statusCode).toBe(201)
  })

  it.each([
    ['not_found', 404, 'queries.save.errors.notFound'],
    ['duplicate_query_name', 409, 'queries.save.errors.duplicateQueryName'],
    ['persistence_unavailable', 503, 'queries.save.errors.persistenceUnavailable'],
    ['unexpected_error', 500, 'queries.save.errors.unexpected']
  ])(
    'maps service error %s to the correct status and message key',
    async (code, status, messageKey) => {
      readBodyMock.mockResolvedValue({})
      validateSaveSavedSqlQueryInputMock.mockReturnValue({
        ok: true,
        data: { queryName: 'Top customers' }
      })
      saveSavedSqlQueryMock.mockResolvedValue({
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

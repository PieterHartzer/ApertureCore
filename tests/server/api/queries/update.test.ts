import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const validateUpdateSavedSqlQueryInputMock = vi.fn()
const getAuthenticatedOrganizationContextMock = vi.fn()
const updateSavedSqlQueryMock = vi.fn()
const readBodyMock = vi.fn()
const getRouterParamMock = vi.fn()
const setResponseStatusMock = vi.fn((event: Record<string, unknown>, status: number) => {
  event.statusCode = status
})

vi.mock('../../../../server/validators/saved-sql-queries', () => ({
  validateUpdateSavedSqlQueryInput: validateUpdateSavedSqlQueryInputMock
}))

vi.mock('../../../../server/utils/auth-organization', () => ({
  getAuthenticatedOrganizationContext: getAuthenticatedOrganizationContextMock
}))

vi.mock('../../../../server/services/saved-sql-queries', () => ({
  updateSavedSqlQuery: updateSavedSqlQueryMock
}))

const loadHandler = async () => {
  vi.resetModules()
  vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
  vi.stubGlobal('readBody', readBodyMock)
  vi.stubGlobal('getRouterParam', getRouterParamMock)
  vi.stubGlobal('setResponseStatus', setResponseStatusMock)

  return (await import('../../../../server/api/queries/[queryId].put')).default as (
    event: Record<string, unknown>
  ) => Promise<unknown>
}

describe('PUT /api/queries/:queryId', () => {
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
      message: 'queries.update.errors.bodyInvalid',
      messageKey: 'queries.update.errors.bodyInvalid'
    })
    expect(event.statusCode).toBe(400)
    expect(validateUpdateSavedSqlQueryInputMock).not.toHaveBeenCalled()
    expect(updateSavedSqlQueryMock).not.toHaveBeenCalled()
  })

  it('returns validator failures with the expected i18n key', async () => {
    readBodyMock.mockResolvedValue({})
    validateUpdateSavedSqlQueryInputMock.mockReturnValue({
      ok: false,
      code: 'invalid_input',
      issue: 'query_id_invalid',
      field: 'queryId',
      message: 'query_id_invalid'
    })

    const handler = await loadHandler()
    const event: Record<string, unknown> = {}

    await expect(handler(event)).resolves.toEqual({
      ok: false,
      code: 'invalid_input',
      issue: 'query_id_invalid',
      field: 'queryId',
      message: 'queries.update.errors.queryIdInvalid',
      messageKey: 'queries.update.errors.queryIdInvalid'
    })
    expect(event.statusCode).toBe(400)
  })

  it('returns success when a query is updated', async () => {
    const validatedInput = {
      queryId: '2f8f9425-55cf-4d8e-a446-638848de1942',
      queryName: 'Top customers',
      connectionId: 'connection-1',
      sql: 'select * from customers'
    }

    readBodyMock.mockResolvedValue(validatedInput)
    validateUpdateSavedSqlQueryInputMock.mockReturnValue({
      ok: true,
      data: validatedInput
    })
    updateSavedSqlQueryMock.mockResolvedValue({
      ok: true,
      code: 'success',
      query: {
        id: 'query-1',
        queryName: 'Top customers',
        connectionId: 'connection-1',
        connectionName: 'Primary DB',
        createdAt: '2026-03-22T00:00:00.000Z',
        updatedAt: '2026-03-22T02:00:00.000Z'
      }
    })

    const handler = await loadHandler()
    const event: Record<string, unknown> = {}

    await expect(handler(event)).resolves.toEqual({
      ok: true,
      code: 'success',
      message: 'queries.update.success',
      messageKey: 'queries.update.success',
      query: {
        id: 'query-1',
        queryName: 'Top customers',
        connectionId: 'connection-1',
        connectionName: 'Primary DB',
        createdAt: '2026-03-22T00:00:00.000Z',
        updatedAt: '2026-03-22T02:00:00.000Z'
      }
    })
    expect(event.statusCode).toBe(200)
  })

  it.each([
    ['not_found', 404, 'queries.update.errors.notFound'],
    ['duplicate_query_name', 409, 'queries.update.errors.duplicateQueryName'],
    ['persistence_unavailable', 503, 'queries.update.errors.persistenceUnavailable'],
    ['unexpected_error', 500, 'queries.update.errors.unexpected']
  ])(
    'maps service error %s to the correct status and message key',
    async (code, status, messageKey) => {
      readBodyMock.mockResolvedValue({})
      validateUpdateSavedSqlQueryInputMock.mockReturnValue({
        ok: true,
        data: {
          queryId: '2f8f9425-55cf-4d8e-a446-638848de1942',
          queryName: 'Top customers'
        }
      })
      updateSavedSqlQueryMock.mockResolvedValue({
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

  it('returns forbidden when the tenant context is missing', async () => {
    readBodyMock.mockResolvedValue({})
    validateUpdateSavedSqlQueryInputMock.mockReturnValue({
      ok: true,
      data: {
        queryId: '2f8f9425-55cf-4d8e-a446-638848de1942',
        queryName: 'Top customers'
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
      message: 'queries.update.errors.forbidden',
      messageKey: 'queries.update.errors.forbidden'
    })
    expect(event.statusCode).toBe(403)
  })

  it('returns unexpected_error when updating throws unexpectedly', async () => {
    readBodyMock.mockResolvedValue({})
    validateUpdateSavedSqlQueryInputMock.mockReturnValue({
      ok: true,
      data: {
        queryId: '2f8f9425-55cf-4d8e-a446-638848de1942',
        queryName: 'Top customers'
      }
    })
    updateSavedSqlQueryMock.mockRejectedValue(new Error('boom'))
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const handler = await loadHandler()
    const event: Record<string, unknown> = {}

    await expect(handler(event)).resolves.toEqual({
      ok: false,
      code: 'unexpected_error',
      message: 'queries.update.errors.unexpected',
      messageKey: 'queries.update.errors.unexpected'
    })
    expect(event.statusCode).toBe(500)
    expect(consoleErrorSpy).toHaveBeenCalled()

    consoleErrorSpy.mockRestore()
  })
})

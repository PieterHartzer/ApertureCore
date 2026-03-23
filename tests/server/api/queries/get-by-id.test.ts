import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const validateSavedSqlQueryIdMock = vi.fn()
const getAuthenticatedOrganizationContextMock = vi.fn()
const getSavedSqlQueryMock = vi.fn()
const getRouterParamMock = vi.fn()
const setResponseStatusMock = vi.fn((event: Record<string, unknown>, status: number) => {
  event.statusCode = status
})

vi.mock('../../../../server/validators/saved-sql-queries', () => ({
  validateSavedSqlQueryId: validateSavedSqlQueryIdMock
}))

vi.mock('../../../../server/utils/auth-organization', () => ({
  getAuthenticatedOrganizationContext: getAuthenticatedOrganizationContextMock
}))

vi.mock('../../../../server/services/saved-sql-queries', () => ({
  getSavedSqlQuery: getSavedSqlQueryMock
}))

const loadHandler = async () => {
  vi.resetModules()
  vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
  vi.stubGlobal('getRouterParam', getRouterParamMock)
  vi.stubGlobal('setResponseStatus', setResponseStatusMock)

  return (await import('../../../../server/api/queries/[queryId].get')).default as (
    event: Record<string, unknown>
  ) => Promise<unknown>
}

describe('GET /api/queries/:queryId', () => {
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

  it('returns a validation error when the query id is invalid', async () => {
    validateSavedSqlQueryIdMock.mockReturnValue({
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
      message: 'queries.edit.errors.queryIdInvalid',
      messageKey: 'queries.edit.errors.queryIdInvalid'
    })
    expect(event.statusCode).toBe(400)
    expect(getSavedSqlQueryMock).not.toHaveBeenCalled()
  })

  it('returns the saved query details for edit', async () => {
    validateSavedSqlQueryIdMock.mockReturnValue({
      ok: true,
      data: {
        queryId: '2f8f9425-55cf-4d8e-a446-638848de1942'
      }
    })
    getSavedSqlQueryMock.mockResolvedValue({
      ok: true,
      code: 'success',
      query: {
        id: 'query-1',
        queryName: 'Top customers',
        connectionId: 'connection-1',
        sql: 'select * from customers',
        createdAt: '2026-03-22T00:00:00.000Z',
        updatedAt: '2026-03-22T01:00:00.000Z'
      }
    })

    const handler = await loadHandler()
    const event: Record<string, unknown> = {}

    await expect(handler(event)).resolves.toEqual({
      ok: true,
      code: 'success',
      message: 'queries.edit.success',
      messageKey: 'queries.edit.success',
      query: {
        id: 'query-1',
        queryName: 'Top customers',
        connectionId: 'connection-1',
        sql: 'select * from customers',
        createdAt: '2026-03-22T00:00:00.000Z',
        updatedAt: '2026-03-22T01:00:00.000Z'
      }
    })
    expect(event.statusCode).toBe(200)
  })

  it.each([
    ['not_found', 404, 'queries.edit.errors.notFound'],
    ['persistence_unavailable', 503, 'queries.edit.errors.persistenceUnavailable'],
    ['unexpected_error', 500, 'queries.edit.errors.unexpected']
  ])(
    'maps service error %s to the correct status and message key',
    async (code, status, messageKey) => {
      validateSavedSqlQueryIdMock.mockReturnValue({
        ok: true,
        data: {
          queryId: '2f8f9425-55cf-4d8e-a446-638848de1942'
        }
      })
      getSavedSqlQueryMock.mockResolvedValue({
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
    validateSavedSqlQueryIdMock.mockReturnValue({
      ok: true,
      data: {
        queryId: '2f8f9425-55cf-4d8e-a446-638848de1942'
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
      message: 'queries.edit.errors.forbidden',
      messageKey: 'queries.edit.errors.forbidden'
    })
    expect(event.statusCode).toBe(403)
  })

  it('returns unexpected_error when loading throws unexpectedly', async () => {
    validateSavedSqlQueryIdMock.mockReturnValue({
      ok: true,
      data: {
        queryId: '2f8f9425-55cf-4d8e-a446-638848de1942'
      }
    })
    getSavedSqlQueryMock.mockRejectedValue(new Error('boom'))
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const handler = await loadHandler()
    const event: Record<string, unknown> = {}

    await expect(handler(event)).resolves.toEqual({
      ok: false,
      code: 'unexpected_error',
      message: 'queries.edit.errors.unexpected',
      messageKey: 'queries.edit.errors.unexpected'
    })
    expect(event.statusCode).toBe(500)
    expect(consoleErrorSpy).toHaveBeenCalled()

    consoleErrorSpy.mockRestore()
  })
})

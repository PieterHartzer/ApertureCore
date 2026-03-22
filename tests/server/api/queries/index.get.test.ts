import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const getAuthenticatedOrganizationContextMock = vi.fn()
const listSavedSqlQueriesMock = vi.fn()
const setResponseStatusMock = vi.fn((event: Record<string, unknown>, status: number) => {
  event.statusCode = status
})

vi.mock('../../../../server/utils/auth-organization', () => ({
  getAuthenticatedOrganizationContext: getAuthenticatedOrganizationContextMock
}))

vi.mock('../../../../server/services/saved-sql-queries', () => ({
  listSavedSqlQueries: listSavedSqlQueriesMock
}))

const loadHandler = async () => {
  vi.resetModules()
  vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
  vi.stubGlobal('setResponseStatus', setResponseStatusMock)

  return (await import('../../../../server/api/queries/index.get')).default as (
    event: Record<string, unknown>
  ) => Promise<unknown>
}

describe('GET /api/queries', () => {
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

  it('returns saved SQL queries for the current organization', async () => {
    listSavedSqlQueriesMock.mockResolvedValue({
      ok: true,
      code: 'success',
      queries: [{
        id: 'query-1',
        queryName: 'Top customers',
        connectionId: 'connection-1',
        connectionName: 'Primary DB',
        createdAt: '2026-03-19T00:00:00.000Z',
        updatedAt: '2026-03-20T00:00:00.000Z'
      }]
    })

    const handler = await loadHandler()
    const event: Record<string, unknown> = {}

    await expect(handler(event)).resolves.toEqual({
      ok: true,
      code: 'success',
      message: 'queries.list.success',
      messageKey: 'queries.list.success',
      queries: [{
        id: 'query-1',
        queryName: 'Top customers',
        connectionId: 'connection-1',
        connectionName: 'Primary DB',
        createdAt: '2026-03-19T00:00:00.000Z',
        updatedAt: '2026-03-20T00:00:00.000Z'
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
      message: 'queries.list.errors.forbidden',
      messageKey: 'queries.list.errors.forbidden'
    })
    expect(event.statusCode).toBe(403)
  })

  it('returns unexpected_error when the service throws unexpectedly', async () => {
    listSavedSqlQueriesMock.mockRejectedValue(new Error('boom'))
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const handler = await loadHandler()
    const event: Record<string, unknown> = {}

    await expect(handler(event)).resolves.toEqual({
      ok: false,
      code: 'unexpected_error',
      message: 'queries.list.errors.unexpected',
      messageKey: 'queries.list.errors.unexpected'
    })
    expect(event.statusCode).toBe(500)
    expect(consoleErrorSpy).toHaveBeenCalled()

    consoleErrorSpy.mockRestore()
  })

  it.each([
    ['persistence_unavailable', 503, 'queries.list.errors.persistenceUnavailable'],
    ['unexpected_error', 500, 'queries.list.errors.unexpected']
  ])(
    'maps service error %s to the correct status and i18n key',
    async (code, status, messageKey) => {
      listSavedSqlQueriesMock.mockResolvedValue({
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

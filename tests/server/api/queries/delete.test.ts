import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const validateDeleteSavedSqlQueryInputMock = vi.fn()
const getAuthenticatedOrganizationContextMock = vi.fn()
const deleteSavedSqlQueryMock = vi.fn()
const readBodyMock = vi.fn()
const getRouterParamMock = vi.fn()
const setResponseStatusMock = vi.fn((event: Record<string, unknown>, status: number) => {
  event.statusCode = status
})

vi.mock('../../../../server/validators/saved-sql-queries', () => ({
  validateDeleteSavedSqlQueryInput: validateDeleteSavedSqlQueryInputMock
}))

vi.mock('../../../../server/utils/auth-organization', () => ({
  getAuthenticatedOrganizationContext: getAuthenticatedOrganizationContextMock
}))

vi.mock('../../../../server/services/saved-sql-queries', () => ({
  deleteSavedSqlQuery: deleteSavedSqlQueryMock
}))

const loadHandler = async () => {
  vi.resetModules()
  vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
  vi.stubGlobal('readBody', readBodyMock)
  vi.stubGlobal('getRouterParam', getRouterParamMock)
  vi.stubGlobal('setResponseStatus', setResponseStatusMock)

  return (await import('../../../../server/api/queries/[queryId].delete')).default as (
    event: Record<string, unknown>
  ) => Promise<unknown>
}

describe('DELETE /api/queries/:queryId', () => {
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
      message: 'queries.delete.errors.bodyInvalid',
      messageKey: 'queries.delete.errors.bodyInvalid'
    })
    expect(event.statusCode).toBe(400)
    expect(validateDeleteSavedSqlQueryInputMock).not.toHaveBeenCalled()
    expect(deleteSavedSqlQueryMock).not.toHaveBeenCalled()
  })

  it('returns validator failures with the expected i18n key', async () => {
    readBodyMock.mockResolvedValue({})
    validateDeleteSavedSqlQueryInputMock.mockReturnValue({
      ok: false,
      code: 'invalid_input',
      issue: 'confirmation_name_required',
      field: 'confirmationName',
      message: 'confirmation_name_required'
    })

    const handler = await loadHandler()
    const event: Record<string, unknown> = {}

    await expect(handler(event)).resolves.toEqual({
      ok: false,
      code: 'invalid_input',
      issue: 'confirmation_name_required',
      field: 'confirmationName',
      message: 'queries.delete.errors.confirmationNameRequired',
      messageKey: 'queries.delete.errors.confirmationNameRequired'
    })
    expect(event.statusCode).toBe(400)
  })

  it('returns success when the query is deleted', async () => {
    const validatedInput = {
      queryId: '2f8f9425-55cf-4d8e-a446-638848de1942',
      confirmationName: 'Top customers'
    }

    readBodyMock.mockResolvedValue(validatedInput)
    validateDeleteSavedSqlQueryInputMock.mockReturnValue({
      ok: true,
      data: validatedInput
    })
    deleteSavedSqlQueryMock.mockResolvedValue({
      ok: true,
      code: 'success'
    })

    const handler = await loadHandler()
    const event: Record<string, unknown> = {}

    await expect(handler(event)).resolves.toEqual({
      ok: true,
      code: 'success',
      message: 'queries.delete.success',
      messageKey: 'queries.delete.success'
    })
    expect(event.statusCode).toBe(200)
  })

  it.each([
    ['confirmation_mismatch', 409, 'queries.delete.errors.confirmationMismatch'],
    ['not_found', 404, 'queries.delete.errors.notFound'],
    ['persistence_unavailable', 503, 'queries.delete.errors.persistenceUnavailable'],
    ['unexpected_error', 500, 'queries.delete.errors.unexpected']
  ])(
    'maps service error %s to the correct status and message key',
    async (code, status, messageKey) => {
      readBodyMock.mockResolvedValue({})
      validateDeleteSavedSqlQueryInputMock.mockReturnValue({
        ok: true,
        data: {
          queryId: '2f8f9425-55cf-4d8e-a446-638848de1942',
          confirmationName: 'Top customers'
        }
      })
      deleteSavedSqlQueryMock.mockResolvedValue({
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
    validateDeleteSavedSqlQueryInputMock.mockReturnValue({
      ok: true,
      data: {
        queryId: '2f8f9425-55cf-4d8e-a446-638848de1942',
        confirmationName: 'Top customers'
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
      message: 'queries.delete.errors.forbidden',
      messageKey: 'queries.delete.errors.forbidden'
    })
    expect(event.statusCode).toBe(403)
  })

  it('returns unexpected_error when deleting throws unexpectedly', async () => {
    readBodyMock.mockResolvedValue({})
    validateDeleteSavedSqlQueryInputMock.mockReturnValue({
      ok: true,
      data: {
        queryId: '2f8f9425-55cf-4d8e-a446-638848de1942',
        confirmationName: 'Top customers'
      }
    })
    deleteSavedSqlQueryMock.mockRejectedValue(new Error('boom'))
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const handler = await loadHandler()
    const event: Record<string, unknown> = {}

    await expect(handler(event)).resolves.toEqual({
      ok: false,
      code: 'unexpected_error',
      message: 'queries.delete.errors.unexpected',
      messageKey: 'queries.delete.errors.unexpected'
    })
    expect(event.statusCode).toBe(500)
    expect(consoleErrorSpy).toHaveBeenCalled()

    consoleErrorSpy.mockRestore()
  })
})

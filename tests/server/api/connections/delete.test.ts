import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const validateDeleteDatabaseConnectionInputMock = vi.fn()
const getAuthenticatedOrganizationContextMock = vi.fn()
const deleteDatabaseConnectionMock = vi.fn()
const readBodyMock = vi.fn()
const getRouterParamMock = vi.fn()
const setResponseStatusMock = vi.fn((event: Record<string, unknown>, status: number) => {
  event.statusCode = status
})

vi.mock('../../../../server/validators/database-connections', () => ({
  validateDeleteDatabaseConnectionInput: validateDeleteDatabaseConnectionInputMock
}))

vi.mock('../../../../server/utils/auth-organization', () => ({
  getAuthenticatedOrganizationContext: getAuthenticatedOrganizationContextMock
}))

vi.mock('../../../../server/services/database-connections', () => ({
  deleteDatabaseConnection: deleteDatabaseConnectionMock
}))

const loadHandler = async () => {
  vi.resetModules()
  vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
  vi.stubGlobal('readBody', readBodyMock)
  vi.stubGlobal('getRouterParam', getRouterParamMock)
  vi.stubGlobal('setResponseStatus', setResponseStatusMock)

  return (await import('../../../../server/api/connections/[connectionId].delete')).default as (
    event: Record<string, unknown>
  ) => Promise<unknown>
}

describe('DELETE /api/connections/:connectionId', () => {
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
      message: 'connections.delete.errors.bodyInvalid',
      messageKey: 'connections.delete.errors.bodyInvalid'
    })
    expect(event.statusCode).toBe(400)
    expect(validateDeleteDatabaseConnectionInputMock).not.toHaveBeenCalled()
    expect(deleteDatabaseConnectionMock).not.toHaveBeenCalled()
  })

  it('returns validator failures with the expected i18n key', async () => {
    readBodyMock.mockResolvedValue({})
    validateDeleteDatabaseConnectionInputMock.mockReturnValue({
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
      message: 'connections.delete.errors.confirmationNameRequired',
      messageKey: 'connections.delete.errors.confirmationNameRequired'
    })
    expect(event.statusCode).toBe(400)
  })

  it('returns forbidden when the tenant context is missing', async () => {
    readBodyMock.mockResolvedValue({})
    validateDeleteDatabaseConnectionInputMock.mockReturnValue({
      ok: true,
      data: {
        connectionId: '2f8f9425-55cf-4d8e-a446-638848de1942',
        confirmationName: 'Primary',
        deleteLinkedQueries: false
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
      message: 'connections.delete.errors.forbidden',
      messageKey: 'connections.delete.errors.forbidden'
    })
    expect(event.statusCode).toBe(403)
  })

  it('returns success when the connection is deleted', async () => {
    const validatedInput = {
      connectionId: '2f8f9425-55cf-4d8e-a446-638848de1942',
      confirmationName: 'Primary',
      deleteLinkedQueries: true
    }

    readBodyMock.mockResolvedValue(validatedInput)
    validateDeleteDatabaseConnectionInputMock.mockReturnValue({
      ok: true,
      data: validatedInput
    })
    deleteDatabaseConnectionMock.mockResolvedValue({
      ok: true,
      code: 'success'
    })

    const handler = await loadHandler()
    const event: Record<string, unknown> = {}

    await expect(handler(event)).resolves.toEqual({
      ok: true,
      code: 'success',
      message: 'connections.delete.success',
      messageKey: 'connections.delete.success'
    })
    expect(event.statusCode).toBe(200)
  })

  it.each([
    ['confirmation_mismatch', 409, 'connections.delete.errors.confirmationMismatch'],
    ['not_found', 404, 'connections.delete.errors.notFound'],
    ['persistence_unavailable', 503, 'connections.delete.errors.persistenceUnavailable'],
    ['unexpected_error', 500, 'connections.delete.errors.unexpected']
  ])(
    'maps service error %s to the correct status and message key',
    async (code, status, messageKey) => {
      readBodyMock.mockResolvedValue({})
      validateDeleteDatabaseConnectionInputMock.mockReturnValue({
        ok: true,
        data: {
          connectionId: '2f8f9425-55cf-4d8e-a446-638848de1942',
          confirmationName: 'Primary',
          deleteLinkedQueries: false
        }
      })
      deleteDatabaseConnectionMock.mockResolvedValue({
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

  it('returns unexpected_error when deleting throws unexpectedly', async () => {
    readBodyMock.mockResolvedValue({})
    validateDeleteDatabaseConnectionInputMock.mockReturnValue({
      ok: true,
      data: {
        connectionId: '2f8f9425-55cf-4d8e-a446-638848de1942',
        confirmationName: 'Primary',
        deleteLinkedQueries: false
      }
    })
    deleteDatabaseConnectionMock.mockRejectedValue(new Error('boom'))
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const handler = await loadHandler()
    const event: Record<string, unknown> = {}

    await expect(handler(event)).resolves.toEqual({
      ok: false,
      code: 'unexpected_error',
      message: 'connections.delete.errors.unexpected',
      messageKey: 'connections.delete.errors.unexpected'
    })
    expect(event.statusCode).toBe(500)
    expect(consoleErrorSpy).toHaveBeenCalled()

    consoleErrorSpy.mockRestore()
  })
})

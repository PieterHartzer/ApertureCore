import { createHash } from 'node:crypto'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const validateRunSavedSqlQueryInputMock = vi.fn()
const getAuthenticatedOrganizationContextMock = vi.fn()
const executeQueryMock = vi.fn()
const readBodyMock = vi.fn()
const useStorageMock = vi.fn()
const useRuntimeConfigMock = vi.fn()
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
  validateRunSavedSqlQueryInput: validateRunSavedSqlQueryInputMock
}))

vi.mock('../../../../server/utils/auth-organization', () => ({
  getAuthenticatedOrganizationContext: getAuthenticatedOrganizationContextMock
}))

vi.mock('../../../../server/utils/database/executeQuery', () => ({
  executeQuery: executeQueryMock
}))

const cacheStorage = {
  getItem: vi.fn(),
  setItem: vi.fn()
}

const buildOrganizationCacheScope = (organizationId: string) => {
  return createHash('sha256')
    .update(organizationId, 'utf8')
    .digest('hex')
    .slice(0, 16)
}

const loadHandler = async () => {
  vi.resetModules()
  vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
  vi.stubGlobal('readBody', readBodyMock)
  vi.stubGlobal('useStorage', useStorageMock)
  vi.stubGlobal('useRuntimeConfig', useRuntimeConfigMock)
  vi.stubGlobal('setResponseStatus', setResponseStatusMock)
  vi.stubGlobal('setResponseHeader', setResponseHeaderMock)

  return (await import('../../../../server/api/query/run.post')).default as (
    event: Record<string, unknown>
  ) => Promise<unknown>
}

describe('POST /api/query/run', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useStorageMock.mockReturnValue(cacheStorage)
    useRuntimeConfigMock.mockReturnValue({
      queryCacheTtlSeconds: 90
    })
    getAuthenticatedOrganizationContextMock.mockReturnValue({
      userId: 'user-1',
      organizationId: 'org-1',
      organizationName: 'ACME'
    })
    cacheStorage.getItem.mockResolvedValue(null)
    cacheStorage.setItem.mockResolvedValue(undefined)
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
      messageKey: 'queries.test.errors.bodyInvalid'
    })
    expect(event.statusCode).toBe(400)
    expect(validateRunSavedSqlQueryInputMock).not.toHaveBeenCalled()
    expect(executeQueryMock).not.toHaveBeenCalled()
  })

  it('returns validator failures with the mapped message key', async () => {
    readBodyMock.mockResolvedValue({})
    validateRunSavedSqlQueryInputMock.mockReturnValue({
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
    expect(executeQueryMock).not.toHaveBeenCalled()
  })

  it('returns cached results without executing the query again', async () => {
    readBodyMock.mockResolvedValue({
      connectionId: '2f8f9425-55cf-4d8e-a446-638848de1942',
      queryId: '7c6d9425-55cf-4d8e-a446-638848de1942'
    })
    validateRunSavedSqlQueryInputMock.mockReturnValue({
      ok: true,
      data: {
        connectionId: '2f8f9425-55cf-4d8e-a446-638848de1942',
        queryId: '7c6d9425-55cf-4d8e-a446-638848de1942'
      }
    })
    cacheStorage.getItem.mockResolvedValue({
      columns: ['id'],
      rows: [{ id: 1 }],
      etag: '"cached-etag"'
    })

    const handler = await loadHandler()
    const event: Record<string, unknown> = {
      node: {
        req: {
          headers: {}
        }
      }
    }

    await expect(handler(event)).resolves.toEqual({
      columns: ['id'],
      rows: [{ id: 1 }],
      etag: '"cached-etag"'
    })
    expect(event.statusCode).toBe(200)
    expect(event.headers).toEqual({
      etag: '"cached-etag"'
    })
    expect(cacheStorage.getItem).toHaveBeenCalledWith(
      `query:${buildOrganizationCacheScope('org-1')}:7c6d9425-55cf-4d8e-a446-638848de1942:2f8f9425-55cf-4d8e-a446-638848de1942`
    )
    expect(executeQueryMock).not.toHaveBeenCalled()
  })

  it('returns 304 when the cached etag matches If-None-Match', async () => {
    readBodyMock.mockResolvedValue({
      connectionId: '2f8f9425-55cf-4d8e-a446-638848de1942',
      queryId: '7c6d9425-55cf-4d8e-a446-638848de1942'
    })
    validateRunSavedSqlQueryInputMock.mockReturnValue({
      ok: true,
      data: {
        connectionId: '2f8f9425-55cf-4d8e-a446-638848de1942',
        queryId: '7c6d9425-55cf-4d8e-a446-638848de1942'
      }
    })
    cacheStorage.getItem.mockResolvedValue({
      columns: ['id'],
      rows: [{ id: 1 }],
      etag: '"cached-etag"'
    })

    const handler = await loadHandler()
    const event: Record<string, unknown> = {
      node: {
        req: {
          headers: {
            'if-none-match': '"cached-etag"'
          }
        }
      }
    }

    await expect(handler(event)).resolves.toBeUndefined()
    expect(event.statusCode).toBe(304)
    expect(event.headers).toEqual({
      etag: '"cached-etag"'
    })
    expect(executeQueryMock).not.toHaveBeenCalled()
  })

  it('matches weak ETags from array request headers against cached responses', async () => {
    readBodyMock.mockResolvedValue({
      connectionId: '2f8f9425-55cf-4d8e-a446-638848de1942',
      queryId: '7c6d9425-55cf-4d8e-a446-638848de1942'
    })
    validateRunSavedSqlQueryInputMock.mockReturnValue({
      ok: true,
      data: {
        connectionId: '2f8f9425-55cf-4d8e-a446-638848de1942',
        queryId: '7c6d9425-55cf-4d8e-a446-638848de1942'
      }
    })
    cacheStorage.getItem.mockResolvedValue({
      columns: ['id'],
      rows: [{ id: 1 }],
      etag: '"cached-etag"'
    })

    const handler = await loadHandler()
    const event: Record<string, unknown> = {
      node: {
        req: {
          headers: {
            'if-none-match': ['W/"cached-etag"']
          }
        }
      }
    }

    await expect(handler(event)).resolves.toBeUndefined()
    expect(event.statusCode).toBe(304)
    expect(executeQueryMock).not.toHaveBeenCalled()
  })

  it('executes, caches, and returns fresh results on a cache miss', async () => {
    readBodyMock.mockResolvedValue({
      connectionId: '2f8f9425-55cf-4d8e-a446-638848de1942',
      queryId: '7c6d9425-55cf-4d8e-a446-638848de1942'
    })
    validateRunSavedSqlQueryInputMock.mockReturnValue({
      ok: true,
      data: {
        connectionId: '2f8f9425-55cf-4d8e-a446-638848de1942',
        queryId: '7c6d9425-55cf-4d8e-a446-638848de1942'
      }
    })
    executeQueryMock.mockResolvedValue({
      ok: true,
      code: 'success',
      columns: ['id', 'name'],
      rows: [{
        id: 1,
        name: 'Alice'
      }],
      rowLimit: 1000
    })

    const handler = await loadHandler()
    const event: Record<string, unknown> = {
      node: {
        req: {
          headers: {}
        }
      }
    }
    const response = await handler(event)

    expect(response).toEqual({
      columns: ['id', 'name'],
      rows: [{
        id: 1,
        name: 'Alice'
      }],
      etag: expect.stringMatching(/^"[a-f0-9]{64}"$/)
    })
    expect(event.statusCode).toBe(200)
    expect(event.headers).toEqual({
      etag: (response as { etag: string }).etag
    })
    expect(cacheStorage.setItem).toHaveBeenCalledWith(
      `query:${buildOrganizationCacheScope('org-1')}:7c6d9425-55cf-4d8e-a446-638848de1942:2f8f9425-55cf-4d8e-a446-638848de1942`,
      response,
      {
        ttl: 90
      }
    )
  })

  it('accepts numeric-string cache TTL values from runtime config', async () => {
    useRuntimeConfigMock.mockReturnValue({
      queryCacheTtlSeconds: '45'
    })
    readBodyMock.mockResolvedValue({
      connectionId: '2f8f9425-55cf-4d8e-a446-638848de1942',
      queryId: '7c6d9425-55cf-4d8e-a446-638848de1942'
    })
    validateRunSavedSqlQueryInputMock.mockReturnValue({
      ok: true,
      data: {
        connectionId: '2f8f9425-55cf-4d8e-a446-638848de1942',
        queryId: '7c6d9425-55cf-4d8e-a446-638848de1942'
      }
    })
    executeQueryMock.mockResolvedValue({
      ok: true,
      code: 'success',
      columns: ['id'],
      rows: [{ id: 1 }],
      rowLimit: 1000
    })

    const handler = await loadHandler()
    const event: Record<string, unknown> = {
      node: {
        req: {
          headers: {}
        }
      }
    }

    await handler(event)

    expect(cacheStorage.setItem).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        columns: ['id'],
        rows: [{ id: 1 }]
      }),
      {
        ttl: 45
      }
    )
  })

  it('does not expose raw execution details in error responses', async () => {
    readBodyMock.mockResolvedValue({
      connectionId: '2f8f9425-55cf-4d8e-a446-638848de1942',
      queryId: '7c6d9425-55cf-4d8e-a446-638848de1942'
    })
    validateRunSavedSqlQueryInputMock.mockReturnValue({
      ok: true,
      data: {
        connectionId: '2f8f9425-55cf-4d8e-a446-638848de1942',
        queryId: '7c6d9425-55cf-4d8e-a446-638848de1942'
      }
    })
    executeQueryMock.mockResolvedValue({
      ok: false,
      code: 'query_failed',
      message: 'query_failed',
      details: 'relation "secret_table" does not exist'
    })

    const handler = await loadHandler()
    const event: Record<string, unknown> = {
      node: {
        req: {
          headers: {}
        }
      }
    }

    await expect(handler(event)).resolves.toEqual({
      ok: false,
      code: 'query_failed',
      message: 'queries.test.errors.queryFailed',
      messageKey: 'queries.test.errors.queryFailed'
    })
    expect(event.statusCode).toBe(400)
  })

  it('returns 304 after a fresh execution when the generated etag matches the request header', async () => {
    readBodyMock.mockResolvedValue({
      connectionId: '2f8f9425-55cf-4d8e-a446-638848de1942',
      queryId: '7c6d9425-55cf-4d8e-a446-638848de1942'
    })
    validateRunSavedSqlQueryInputMock.mockReturnValue({
      ok: true,
      data: {
        connectionId: '2f8f9425-55cf-4d8e-a446-638848de1942',
        queryId: '7c6d9425-55cf-4d8e-a446-638848de1942'
      }
    })
    executeQueryMock.mockResolvedValue({
      ok: true,
      code: 'success',
      columns: ['id'],
      rows: [{ id: 1 }],
      rowLimit: 1000
    })

    const initialHandler = await loadHandler()
    const initialEvent: Record<string, unknown> = {
      node: {
        req: {
          headers: {}
        }
      }
    }
    const initialResponse = await initialHandler(initialEvent) as { etag: string }

    const handler = await loadHandler()
    const event: Record<string, unknown> = {
      node: {
        req: {
          headers: {
            'if-none-match': initialResponse.etag
          }
        }
      }
    }

    await expect(handler(event)).resolves.toBeUndefined()
    expect(event.statusCode).toBe(304)
    expect(event.headers).toEqual({
      etag: initialResponse.etag
    })
  })

  it.each([
    ['forbidden', 403, 'queries.test.errors.forbidden'],
    ['authentication_failed', 401, 'queries.test.errors.authenticationFailed'],
    ['database_not_found', 404, 'queries.test.errors.databaseNotFound'],
    ['connection_failed', 503, 'queries.test.errors.connectionFailed'],
    ['unsupported_database_type', 400, 'queries.test.errors.unsupportedDatabaseType'],
    ['ssl_required', 400, 'queries.test.errors.sslRequired'],
    ['query_rejected', 400, 'queries.test.errors.queryRejected'],
    ['query_failed', 400, 'queries.test.errors.queryFailed'],
    ['timeout', 504, 'queries.test.errors.timeout'],
    ['persistence_unavailable', 503, 'queries.test.errors.persistenceUnavailable']
  ])(
    'maps execution error %s to the expected response',
    async (code, statusCode, messageKey) => {
      readBodyMock.mockResolvedValue({
        connectionId: '2f8f9425-55cf-4d8e-a446-638848de1942',
        queryId: '7c6d9425-55cf-4d8e-a446-638848de1942'
      })
      validateRunSavedSqlQueryInputMock.mockReturnValue({
        ok: true,
        data: {
          connectionId: '2f8f9425-55cf-4d8e-a446-638848de1942',
          queryId: '7c6d9425-55cf-4d8e-a446-638848de1942'
        }
      })
      executeQueryMock.mockResolvedValue({
        ok: false,
        code,
        message: code
      })

      const handler = await loadHandler()
      const event: Record<string, unknown> = {
        node: {
          req: {
            headers: {}
          }
        }
      }

      await expect(handler(event)).resolves.toEqual({
        ok: false,
        code,
        message: messageKey,
        messageKey
      })
      expect(event.statusCode).toBe(statusCode)
    }
  )

  it('returns forbidden when organization authentication fails', async () => {
    readBodyMock.mockResolvedValue({
      connectionId: '2f8f9425-55cf-4d8e-a446-638848de1942',
      queryId: '7c6d9425-55cf-4d8e-a446-638848de1942'
    })
    validateRunSavedSqlQueryInputMock.mockReturnValue({
      ok: true,
      data: {
        connectionId: '2f8f9425-55cf-4d8e-a446-638848de1942',
        queryId: '7c6d9425-55cf-4d8e-a446-638848de1942'
      }
    })
    getAuthenticatedOrganizationContextMock.mockImplementation(() => {
      throw {
        statusCode: 403
      }
    })

    const handler = await loadHandler()
    const event: Record<string, unknown> = {
      node: {
        req: {
          headers: {}
        }
      }
    }

    await expect(handler(event)).resolves.toEqual({
      ok: false,
      code: 'forbidden',
      message: 'queries.test.errors.forbidden',
      messageKey: 'queries.test.errors.forbidden'
    })
    expect(event.statusCode).toBe(403)
  })

  it('returns unexpected_error when execution throws unexpectedly', async () => {
    readBodyMock.mockResolvedValue({
      connectionId: '2f8f9425-55cf-4d8e-a446-638848de1942',
      queryId: '7c6d9425-55cf-4d8e-a446-638848de1942'
    })
    validateRunSavedSqlQueryInputMock.mockReturnValue({
      ok: true,
      data: {
        connectionId: '2f8f9425-55cf-4d8e-a446-638848de1942',
        queryId: '7c6d9425-55cf-4d8e-a446-638848de1942'
      }
    })
    executeQueryMock.mockRejectedValue(new Error('boom'))
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const handler = await loadHandler()
    const event: Record<string, unknown> = {
      node: {
        req: {
          headers: {}
        }
      }
    }

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

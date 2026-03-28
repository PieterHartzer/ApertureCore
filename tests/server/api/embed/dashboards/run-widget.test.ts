import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const resolveEmbeddedDashboardWidgetExecutionContextMock = vi.fn()
const executeResolvedSavedQueryMock = vi.fn()
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

class AppDatabaseConfigurationError extends Error {}

vi.mock('../../../../../server/utils/database/executeEmbeddedDashboardWidgetQuery', () => ({
  resolveEmbeddedDashboardWidgetExecutionContext: resolveEmbeddedDashboardWidgetExecutionContextMock
}))

vi.mock('../../../../../server/utils/database/executeQuery', () => ({
  executeResolvedSavedQuery: executeResolvedSavedQueryMock
}))

vi.mock('../../../../../server/utils/app-database', () => ({
  AppDatabaseConfigurationError
}))

const cacheStorage = {
  getItem: vi.fn(),
  setItem: vi.fn()
}

const CACHE_KEY = 'embed-query:c148241d0789f4a5:7c6d9425-55cf-4d8e-a446-638848de1942:query-1:2026-03-25T00:00:00.000Z:2026-03-25T00:00:00.000Z'

const loadHandler = async () => {
  vi.resetModules()
  vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
  vi.stubGlobal('useStorage', useStorageMock)
  vi.stubGlobal('useRuntimeConfig', useRuntimeConfigMock)
  vi.stubGlobal('setResponseStatus', setResponseStatusMock)
  vi.stubGlobal('setResponseHeader', setResponseHeaderMock)

  return (await import('../../../../../server/api/embed/dashboards/[embedId]/widgets/[widgetId]/run.post')).default as (
    event: Record<string, unknown> & { context: { params: Record<string, string> } }
  ) => Promise<unknown>
}

describe('POST /api/embed/dashboards/:embedId/widgets/:widgetId/run', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useStorageMock.mockReturnValue(cacheStorage)
    useRuntimeConfigMock.mockReturnValue({
      queryCacheTtlSeconds: 90
    })
    resolveEmbeddedDashboardWidgetExecutionContextMock.mockResolvedValue({
      cacheVersion: 'query-1:2026-03-25T00:00:00.000Z:2026-03-25T00:00:00.000Z',
      executionResource: {
        encrypted_sql: 'encrypted-sql',
        database_type: 'postgres',
        encrypted_secret: 'encrypted-secret'
      }
    })
    executeResolvedSavedQueryMock.mockResolvedValue({
      ok: true,
      code: 'success',
      columns: ['day', 'sales'],
      rows: [{
        day: '2026-03-25',
        sales: 120
      }],
      rowLimit: 1000
    })
    cacheStorage.getItem.mockResolvedValue(null)
    cacheStorage.setItem.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns a validation error for invalid embed ids', async () => {
    const handler = await loadHandler()
    const event = {
      context: {
        params: {
          embedId: 'bad-id',
          widgetId: '7c6d9425-55cf-4d8e-a446-638848de1942'
        }
      }
    }

    await expect(handler(event)).resolves.toEqual({
      ok: false,
      code: 'invalid_input',
      issue: 'embed_id_invalid',
      field: 'embedId',
      message: 'dashboards.embed.run.errors.embedIdInvalid',
      messageKey: 'dashboards.embed.run.errors.embedIdInvalid'
    })
    expect(event.statusCode).toBe(400)
  })

  it('returns a validation error for invalid widget ids', async () => {
    const handler = await loadHandler()
    const event = {
      context: {
        params: {
          embedId: '2f8f9425-55cf-4d8e-a446-638848de1942',
          widgetId: 'bad-id'
        }
      }
    }

    await expect(handler(event)).resolves.toEqual({
      ok: false,
      code: 'invalid_input',
      issue: 'widget_id_invalid',
      field: 'widgetId',
      message: 'dashboards.embed.run.errors.widgetIdInvalid',
      messageKey: 'dashboards.embed.run.errors.widgetIdInvalid'
    })
    expect(event.statusCode).toBe(400)
  })

  it('returns cached embedded widget results without re-executing the external query', async () => {
    cacheStorage.getItem.mockResolvedValue({
      columns: ['id'],
      rows: [{ id: 1 }],
      etag: '"cached-etag"'
    })

    const handler = await loadHandler()
    const event = {
      context: {
        params: {
          embedId: '2f8f9425-55cf-4d8e-a446-638848de1942',
          widgetId: '7c6d9425-55cf-4d8e-a446-638848de1942'
        }
      },
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
    expect(cacheStorage.getItem).toHaveBeenCalledWith(CACHE_KEY)
    expect(resolveEmbeddedDashboardWidgetExecutionContextMock).toHaveBeenCalledTimes(1)
    expect(executeResolvedSavedQueryMock).not.toHaveBeenCalled()
  })

  it('returns 304 when the cached embedded widget result matches If-None-Match', async () => {
    cacheStorage.getItem.mockResolvedValue({
      columns: ['id'],
      rows: [{ id: 1 }],
      etag: '"cached-etag"'
    })

    const handler = await loadHandler()
    const event = {
      context: {
        params: {
          embedId: '2f8f9425-55cf-4d8e-a446-638848de1942',
          widgetId: '7c6d9425-55cf-4d8e-a446-638848de1942'
        }
      },
      node: {
        req: {
          headers: {
            'if-none-match': 'W/"cached-etag"'
          }
        }
      }
    }

    await expect(handler(event)).resolves.toBeUndefined()
    expect(event.statusCode).toBe(304)
    expect(executeResolvedSavedQueryMock).not.toHaveBeenCalled()
  })

  it('returns not_found and skips cache reads when the widget is no longer embeddable', async () => {
    resolveEmbeddedDashboardWidgetExecutionContextMock.mockResolvedValue(null)

    const handler = await loadHandler()
    const event = {
      context: {
        params: {
          embedId: '2f8f9425-55cf-4d8e-a446-638848de1942',
          widgetId: '7c6d9425-55cf-4d8e-a446-638848de1942'
        }
      },
      node: {
        req: {
          headers: {}
        }
      }
    }

    await expect(handler(event)).resolves.toEqual({
      ok: false,
      code: 'not_found',
      message: 'dashboards.embed.run.errors.notFound',
      messageKey: 'dashboards.embed.run.errors.notFound'
    })
    expect(event.statusCode).toBe(404)
    expect(cacheStorage.getItem).not.toHaveBeenCalled()
    expect(executeResolvedSavedQueryMock).not.toHaveBeenCalled()
  })

  it('executes and caches embedded widget query results on a cache miss', async () => {
    const handler = await loadHandler()
    const event = {
      context: {
        params: {
          embedId: '2f8f9425-55cf-4d8e-a446-638848de1942',
          widgetId: '7c6d9425-55cf-4d8e-a446-638848de1942'
        }
      },
      node: {
        req: {
          headers: {}
        }
      }
    }

    const response = await handler(event)

    expect(response).toMatchObject({
      columns: ['day', 'sales'],
      rows: [{
        day: '2026-03-25',
        sales: 120
      }]
    })
    expect(event.statusCode).toBe(200)
    expect(cacheStorage.setItem).toHaveBeenCalledWith(
      CACHE_KEY,
      expect.objectContaining({
        etag: expect.any(String)
      }),
      {
        ttl: 90
      }
    )
    expect(executeResolvedSavedQueryMock).toHaveBeenCalledTimes(1)
  })

  it('returns 304 when a freshly executed result matches If-None-Match', async () => {
    const handler = await loadHandler()
    const event = {
      context: {
        params: {
          embedId: '2f8f9425-55cf-4d8e-a446-638848de1942',
          widgetId: '7c6d9425-55cf-4d8e-a446-638848de1942'
        }
      },
      node: {
        req: {
          headers: {
            'if-none-match': '*'
          }
        }
      }
    }

    await expect(handler(event)).resolves.toBeUndefined()
    expect(event.statusCode).toBe(304)
    expect(cacheStorage.setItem).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['not_found', 404, 'dashboards.embed.run.errors.notFound'],
    ['unsupported_database_type', 400, 'dashboards.embed.run.errors.unsupportedDatabaseType'],
    ['authentication_failed', 401, 'dashboards.embed.run.errors.authenticationFailed'],
    ['database_not_found', 404, 'dashboards.embed.run.errors.databaseNotFound'],
    ['connection_failed', 503, 'dashboards.embed.run.errors.connectionFailed'],
    ['timeout', 504, 'dashboards.embed.run.errors.timeout'],
    ['ssl_required', 400, 'dashboards.embed.run.errors.sslRequired'],
    ['query_rejected', 400, 'dashboards.embed.run.errors.queryRejected'],
    ['query_failed', 400, 'dashboards.embed.run.errors.queryFailed'],
    ['persistence_unavailable', 503, 'dashboards.embed.run.errors.persistenceUnavailable'],
    ['unexpected_error', 500, 'dashboards.embed.run.errors.unexpected']
  ])(
    'maps embedded widget execution error %s to the correct status and message key',
    async (code, status, messageKey) => {
      executeResolvedSavedQueryMock.mockResolvedValue({
        ok: false,
        code,
        message: code
      })

      const handler = await loadHandler()
      const event = {
        context: {
          params: {
            embedId: '2f8f9425-55cf-4d8e-a446-638848de1942',
            widgetId: '7c6d9425-55cf-4d8e-a446-638848de1942'
          }
        },
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
      expect(event.statusCode).toBe(status)
    }
  )

  it('returns unexpected_error when resolving the embedded widget execution throws', async () => {
    resolveEmbeddedDashboardWidgetExecutionContextMock.mockRejectedValue(new Error('boom'))
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const handler = await loadHandler()
    const event = {
      context: {
        params: {
          embedId: '2f8f9425-55cf-4d8e-a446-638848de1942',
          widgetId: '7c6d9425-55cf-4d8e-a446-638848de1942'
        }
      },
      node: {
        req: {
          headers: {}
        }
      }
    }

    await expect(handler(event)).resolves.toEqual({
      ok: false,
      code: 'unexpected_error',
      message: 'dashboards.embed.run.errors.unexpected',
      messageKey: 'dashboards.embed.run.errors.unexpected'
    })
    expect(event.statusCode).toBe(500)
    expect(consoleErrorSpy).toHaveBeenCalled()

    consoleErrorSpy.mockRestore()
  })

  it('returns persistence_unavailable when the app database is unavailable during cache resolution', async () => {
    resolveEmbeddedDashboardWidgetExecutionContextMock.mockRejectedValue(
      new AppDatabaseConfigurationError('missing db')
    )

    const handler = await loadHandler()
    const event = {
      context: {
        params: {
          embedId: '2f8f9425-55cf-4d8e-a446-638848de1942',
          widgetId: '7c6d9425-55cf-4d8e-a446-638848de1942'
        }
      },
      node: {
        req: {
          headers: {}
        }
      }
    }

    await expect(handler(event)).resolves.toEqual({
      ok: false,
      code: 'persistence_unavailable',
      message: 'dashboards.embed.run.errors.persistenceUnavailable',
      messageKey: 'dashboards.embed.run.errors.persistenceUnavailable'
    })
    expect(event.statusCode).toBe(503)
  })
})

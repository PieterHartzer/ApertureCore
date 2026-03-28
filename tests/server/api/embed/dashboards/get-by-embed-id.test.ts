import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const validateDashboardEmbedIdMock = vi.fn()
const getEmbeddedDashboardMock = vi.fn()
const setResponseStatusMock = vi.fn((event: Record<string, unknown>, status: number) => {
  event.statusCode = status
})

vi.mock('../../../../../server/validators/dashboards', () => ({
  validateDashboardEmbedId: validateDashboardEmbedIdMock
}))

vi.mock('../../../../../server/services/dashboards', () => ({
  getEmbeddedDashboard: getEmbeddedDashboardMock
}))

const loadHandler = async () => {
  vi.resetModules()
  vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
  vi.stubGlobal('setResponseStatus', setResponseStatusMock)

  return (await import('../../../../../server/api/embed/dashboards/[embedId].get')).default as (
    event: Record<string, unknown> & {
      context: {
        params?: Record<string, string>
      }
    }
  ) => Promise<unknown>
}

describe('GET /api/embed/dashboards/:embedId', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns a validation error when the embed id is invalid', async () => {
    validateDashboardEmbedIdMock.mockReturnValue({
      ok: false,
      code: 'invalid_input',
      issue: 'embed_id_invalid',
      field: 'embedId',
      message: 'embed_id_invalid'
    })

    const handler = await loadHandler()
    const event = {
      context: {
        params: {
          embedId: 'bad-id'
        }
      }
    }

    await expect(handler(event)).resolves.toEqual({
      ok: false,
      code: 'invalid_input',
      issue: 'embed_id_invalid',
      field: 'embedId',
      message: 'dashboards.embed.get.errors.embedIdInvalid',
      messageKey: 'dashboards.embed.get.errors.embedIdInvalid'
    })
    expect(event.statusCode).toBe(400)
    expect(getEmbeddedDashboardMock).not.toHaveBeenCalled()
  })

  it('returns the embedded dashboard payload', async () => {
    validateDashboardEmbedIdMock.mockReturnValue({
      ok: true,
      data: {
        embedId: 'embed-1'
      }
    })
    getEmbeddedDashboardMock.mockResolvedValue({
      ok: true,
      code: 'success',
      dashboard: {
        embedId: 'embed-1',
        dashboardName: 'Executive overview',
        updatedAt: '2026-03-24T01:00:00.000Z',
        widgets: [{
          id: 'widget-1',
          title: 'Revenue',
          pluginId: 'table',
          pluginConfig: {},
          layout: {
            w: 6,
            h: 4
          },
          refreshIntervalSeconds: 15
        }]
      }
    })

    const handler = await loadHandler()
    const event = {
      context: {
        params: {
          embedId: 'embed-1'
        }
      }
    }

    await expect(handler(event)).resolves.toEqual({
      ok: true,
      code: 'success',
      message: 'dashboards.embed.get.success',
      messageKey: 'dashboards.embed.get.success',
      dashboard: {
        embedId: 'embed-1',
        dashboardName: 'Executive overview',
        updatedAt: '2026-03-24T01:00:00.000Z',
        widgets: [{
          id: 'widget-1',
          title: 'Revenue',
          pluginId: 'table',
          pluginConfig: {},
          layout: {
            w: 6,
            h: 4
          },
          refreshIntervalSeconds: 15
        }]
      }
    })
    expect(event.statusCode).toBe(200)
  })

  it.each([
    ['not_found', 404, 'dashboards.embed.get.errors.notFound'],
    ['persistence_unavailable', 503, 'dashboards.embed.get.errors.persistenceUnavailable'],
    ['unexpected_error', 500, 'dashboards.embed.get.errors.unexpected']
  ])(
    'maps service error %s to the correct status and message key',
    async (code, status, messageKey) => {
      validateDashboardEmbedIdMock.mockReturnValue({
        ok: true,
        data: {
          embedId: 'embed-1'
        }
      })
      getEmbeddedDashboardMock.mockResolvedValue({
        ok: false,
        code,
        message: code
      })

      const handler = await loadHandler()
      const event = {
        context: {
          params: {
            embedId: 'embed-1'
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

  it('returns unexpected_error when loading throws unexpectedly', async () => {
    validateDashboardEmbedIdMock.mockReturnValue({
      ok: true,
      data: {
        embedId: 'embed-1'
      }
    })
    getEmbeddedDashboardMock.mockRejectedValue(new Error('boom'))
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const handler = await loadHandler()
    const event = {
      context: {
        params: {
          embedId: 'embed-1'
        }
      }
    }

    await expect(handler(event)).resolves.toEqual({
      ok: false,
      code: 'unexpected_error',
      message: 'dashboards.embed.get.errors.unexpected',
      messageKey: 'dashboards.embed.get.errors.unexpected'
    })
    expect(event.statusCode).toBe(500)
    expect(consoleErrorSpy).toHaveBeenCalled()

    consoleErrorSpy.mockRestore()
  })
})

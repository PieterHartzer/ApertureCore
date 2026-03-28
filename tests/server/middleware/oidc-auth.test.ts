import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const requireUserSessionMock = vi.fn()
const setResponseStatusMock = vi.fn((event: Record<string, unknown>, status: number) => {
  event.statusCode = status
})

vi.mock('h3', () => ({
  setResponseStatus: setResponseStatusMock
}))

vi.mock('nuxt-oidc-auth/runtime/server/utils/session.js', () => ({
  requireUserSession: requireUserSessionMock
}))

const loadMiddleware = async () => {
  vi.resetModules()
  vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)

  return (await import('../../../server/middleware/oidc-auth')).default as (
    event: Record<string, unknown> & { context: Record<string, unknown>, path: string }
  ) => Promise<unknown>
}

describe('server OIDC auth middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireUserSessionMock.mockResolvedValue({
      provider: 'oidc',
      userName: 'test-user',
      canRefresh: true,
      expireAt: 9999999999
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('skips non-api routes', async () => {
    const middleware = await loadMiddleware()
    const event = {
      path: '/connections/new',
      context: {}
    }

    await expect(middleware(event)).resolves.toBeUndefined()
    expect(requireUserSessionMock).not.toHaveBeenCalled()
  })

  it('skips public api routes', async () => {
    const middleware = await loadMiddleware()
    const event = {
      path: '/api/health',
      context: {}
    }

    await expect(middleware(event)).resolves.toBeUndefined()
    expect(requireUserSessionMock).not.toHaveBeenCalled()
  })

  it('skips internal icon api routes', async () => {
    const middleware = await loadMiddleware()
    const event = {
      path: '/api/_nuxt_icon/lucide/check',
      context: {}
    }

    await expect(middleware(event)).resolves.toBeUndefined()
    expect(requireUserSessionMock).not.toHaveBeenCalled()
  })

  it('skips public embed api routes', async () => {
    const middleware = await loadMiddleware()
    const event = {
      path: '/api/embed/dashboards/2f8f9425-55cf-4d8e-a446-638848de1942',
      context: {}
    }

    await expect(middleware(event)).resolves.toBeUndefined()
    expect(requireUserSessionMock).not.toHaveBeenCalled()
  })

  it('attaches the authenticated user to the event context for protected api routes', async () => {
    const middleware = await loadMiddleware()
    const event = {
      path: '/api/connections/test',
      context: {}
    }

    await expect(middleware(event)).resolves.toBeUndefined()
    expect(requireUserSessionMock).toHaveBeenCalledWith(event)
    expect(event.context.auth).toEqual({
      provider: 'oidc',
      userName: 'test-user',
      canRefresh: true,
      expireAt: 9999999999
    })
  })

  it('returns a structured unauthorized api response when auth validation fails', async () => {
    requireUserSessionMock.mockRejectedValue({
      statusCode: 401
    })

    const middleware = await loadMiddleware()
    const event = {
      path: '/api/connections/test',
      context: {}
    }

    await expect(middleware(event)).resolves.toEqual({
      ok: false,
      code: 'unauthorized',
      message: 'errors.auth.unauthorized',
      messageKey: 'errors.auth.unauthorized'
    })
    expect(event.statusCode).toBe(401)
  })
})

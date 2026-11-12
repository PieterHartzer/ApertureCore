import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const loadEmbedAccessMock = vi.fn()
const embedAccessMock = vi.fn()

vi.mock('../../../server/utils/app-database', () => ({ getAppDatabase: vi.fn() }))

vi.mock('../../../server/utils/embed-access', async (original) => ({
  ...await original<typeof import('../../../server/utils/embed-access')>(),
  loadEmbedAccess: loadEmbedAccessMock
}))

vi.mock('../../../server/utils/extensions', () => ({
  serverExtensions: { get embedAccess() { return embedAccessMock } }
}))

const EMBED = '11111111-1111-4111-8111-111111111111'

interface FakeEvent { path: string, headers: Record<string, string>, query: Record<string, string>, context: Record<string, unknown>, status?: number, responseHeaders: Record<string, string> }

const event = (path: string, headers: Record<string, string> = {}, query: Record<string, string> = {}): FakeEvent => ({ path, headers, query, context: {}, responseHeaders: {} })

const loadMiddleware = async () => {
  vi.resetModules()
  vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
  vi.stubGlobal('getRequestURL', (e: FakeEvent) => new URL(`https://app.test${e.path}`))
  vi.stubGlobal('getRequestHeader', (e: FakeEvent, name: string) => e.headers[name])
  vi.stubGlobal('getQuery', (e: FakeEvent) => e.query)
  vi.stubGlobal('setResponseStatus', (e: FakeEvent, status: number) => { e.status = status })
  vi.stubGlobal('setResponseHeader', (e: FakeEvent, name: string, value: string) => { e.responseHeaders[name] = value })

  return (await import('../../../server/middleware/embed-access')).default as (e: FakeEvent) => Promise<unknown>
}

describe('embed access middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    embedAccessMock.mockResolvedValue({ ok: true })
  })

  afterEach(() => vi.unstubAllGlobals())

  it('ignores other routes and unknown embeds', async () => {
    const middleware = await loadMiddleware()

    await expect(middleware(event('/dashboards'))).resolves.toBeUndefined()
    loadEmbedAccessMock.mockResolvedValue(null)
    await expect(middleware(event(`/embed/dashboard/${EMBED}`))).resolves.toBeUndefined()
  })

  it('shows an embed with no allowed websites anywhere', async () => {
    const middleware = await loadMiddleware()

    loadEmbedAccessMock.mockResolvedValue({ embedId: EMBED, dashboardId: 'd', organizationId: 'o', allowedOrigins: [] })

    const request = event(`/embed/dashboard/${EMBED}`, { 'sec-fetch-dest': 'document' })

    await expect(middleware(request)).resolves.toBeUndefined()
    expect(request.responseHeaders['Content-Security-Policy']).toBeUndefined()
  })

  it('limits framing to the allowed websites and refuses opening the link directly', async () => {
    const middleware = await loadMiddleware()

    loadEmbedAccessMock.mockResolvedValue({ embedId: EMBED, dashboardId: 'd', organizationId: 'o', allowedOrigins: ['https://portal.example.com'] })

    const framed = event(`/embed/dashboard/${EMBED}`, { 'sec-fetch-dest': 'iframe' })

    await expect(middleware(framed)).resolves.toBeUndefined()
    expect(framed.responseHeaders['Content-Security-Policy']).toBe('frame-ancestors https://portal.example.com')

    const direct = event(`/embed/dashboard/${EMBED}`, { 'sec-fetch-dest': 'document' })

    expect(await middleware(direct)).toContain('another website')
    expect(direct.status).toBe(403)

    const noHeader = event(`/embed/dashboard/${EMBED}`)

    await middleware(noHeader)
    expect(noHeader.status).toBe(403)
  })

  it('passes the page token and the data header to the layer, and refuses when it says no', async () => {
    const middleware = await loadMiddleware()

    loadEmbedAccessMock.mockResolvedValue({ embedId: EMBED, dashboardId: 'd', organizationId: 'o', allowedOrigins: [] })
    embedAccessMock.mockResolvedValue({ ok: false, reason: 'expired' })

    const page = event(`/embed/dashboard/${EMBED}`, {}, { token: 'page-token' })

    expect(await middleware(page)).toContain('expired')
    expect(embedAccessMock).toHaveBeenLastCalledWith(expect.objectContaining({ kind: 'page', token: 'page-token', dashboardId: 'd' }))

    const data = event(`/api/embed/dashboards/${EMBED}/widgets/w/run`, { 'x-embed-token': 'data-token' })

    await expect(middleware(data)).resolves.toMatchObject({ ok: false, code: 'forbidden' })
    expect(data.status).toBe(403)
    expect(embedAccessMock).toHaveBeenLastCalledWith(expect.objectContaining({ kind: 'data', token: 'data-token' }))
  })
})

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ schema: vi.fn(), auth: vi.fn(), limit: vi.fn(), param: vi.fn(), status: vi.fn(), header: vi.fn() }))
vi.mock('../../../../server/services/database-schema', () => ({ getDatabaseSchema: mocks.schema }))
vi.mock('../../../../server/utils/auth-organization', () => ({ getAuthenticatedOrganizationContext: mocks.auth }))
vi.mock('../../../../server/utils/authenticated-rate-limit', () => ({ consumeAuthenticatedFixedWindowRateLimit: mocks.limit }))
const context = { organizationId: 'tenant-a', userId: 'user-a' }
const id = '11111111-1111-4111-8111-111111111111'
const load = async () => {
  vi.resetModules()
  vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
  vi.stubGlobal('getRouterParam', mocks.param)
  vi.stubGlobal('setResponseStatus', mocks.status)
  vi.stubGlobal('setResponseHeader', mocks.header)
  vi.stubGlobal('createError', (options: { statusCode: number, statusMessage: string }) => Object.assign(new Error(options.statusMessage), options))
  return (await import('../../../../server/api/connections/[connectionId]/schema.get')).default as (event: object) => Promise<unknown>
}
describe('database schema API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth.mockReturnValue(context)
    mocks.param.mockReturnValue(id)
    mocks.limit.mockResolvedValue({ allowed: true })
  })
  afterEach(() => vi.unstubAllGlobals())
  it('uses the authenticated organization, never a browser-supplied tenant', async () => {
    mocks.schema.mockResolvedValue({ ok: true, schema: 'orders.id int4', columnCount: 1 })
    const handler = await load()
    await expect(handler({})).resolves.toMatchObject({ ok: true, columnCount: 1 })
    expect(mocks.schema).toHaveBeenCalledWith(context, id)
  })
  it('rejects invalid connection identifiers before executing SQL', async () => {
    mocks.param.mockReturnValue('../other')
    const handler = await load()
    await expect(handler({})).rejects.toMatchObject({ statusCode: 400 })
    expect(mocks.schema).not.toHaveBeenCalled()
  })
  it('limits discovery requests', async () => {
    mocks.limit.mockResolvedValue({ allowed: false, retryAfterSeconds: 25 })
    const handler = await load()
    await expect(handler({})).rejects.toMatchObject({ statusCode: 429 })
    expect(mocks.header).toHaveBeenCalledWith({}, 'retry-after', 25)
    expect(mocks.schema).not.toHaveBeenCalled()
  })
  it('returns an actionable connectivity message without raw database details', async () => {
    mocks.schema.mockResolvedValue({ ok: false, code: 'connection_failed', details: 'sensitive internal details' })
    const handler = await load()
    const result = await handler({})
    expect(result).toMatchObject({ ok: false, code: 'connection_failed', message: expect.stringContaining('hostname and port') })
    expect(result).not.toHaveProperty('details')
    expect(mocks.status).toHaveBeenCalledWith({}, 503)
  })
  it('does not query without an authenticated organization', async () => {
    mocks.auth.mockImplementationOnce(() => { throw Object.assign(new Error('forbidden'), { statusCode: 403 }) })
    const handler = await load()
    await expect(handler({})).rejects.toMatchObject({ statusCode: 403 })
    expect(mocks.schema).not.toHaveBeenCalled()
  })
})

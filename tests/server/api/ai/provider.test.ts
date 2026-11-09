import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ owner: vi.fn(), read: vi.fn(), request: vi.fn(), limit: vi.fn() }))
vi.mock('../../../../server/utils/auth-organization', () => ({ getAuthenticatedOrganizationContext: mocks.owner }))
vi.mock('../../../../server/services/ai-settings', () => ({ readAISettings: mocks.read }))
vi.mock('../../../../server/utils/authenticated-rate-limit', () => ({ consumeAuthenticatedFixedWindowRateLimit: mocks.limit }))
vi.mock('../../../../shared/utils/ai-provider', async original => ({ ...await original<typeof import('../../../../shared/utils/ai-provider')>(), providerRequest: mocks.request }))
const event = () => ({ node: { res: { on: vi.fn(), off: vi.fn() } } })
const load = async (input: unknown) => {
  vi.stubGlobal('defineEventHandler', (callback: unknown) => callback)
  vi.stubGlobal('readBody', vi.fn().mockResolvedValue({ databaseType: 'postgres', ...input as object }))
  vi.stubGlobal('createError', (input: { statusCode: number, statusMessage: string }) => Object.assign(new Error(input.statusMessage), input))
  return (await import('../../../../server/api/ai/provider.post')).default as (value: ReturnType<typeof event>) => Promise<unknown>
}
beforeEach(() => {
  mocks.owner.mockReturnValue({ organizationId: 'org', userId: 'owner' })
  mocks.limit.mockResolvedValue({ allowed: true })
  mocks.read.mockResolvedValue({ settings: { connections: [{ id: 'owned', providerType: 'openai', baseUrl: 'https://api.openai.com/v1' }], models: [{ id: 'model', modelId: 'gpt-4.1', providerConnectionId: 'owned' }] }, credentials: { owned: 'encrypted-at-rest-key' } })
})
afterEach(() => vi.unstubAllGlobals())
describe('server OpenAI routing and credential isolation', () => {
  it('checks each named Azure deployment using the api-key header', async () => {
    mocks.read.mockResolvedValue({ settings: { connections: [{ id: 'owned', providerType: 'azure', baseUrl: 'https://acme.openai.azure.com/openai/v1' }], models: [] }, credentials: { owned: 'azure-key' } })
    mocks.request.mockClear()
    mocks.request.mockResolvedValue({ choices: [{ message: { content: 'OK' } }] })
    const handler = await load({ connectionId: 'owned', deployments: ['gpt-4o', 'bad name'] })
    expect(await handler(event())).toEqual({ modelIds: ['gpt-4o'] })
    expect(mocks.request).toHaveBeenCalledTimes(1)
    const call = mocks.request.mock.calls[0]!
    expect(call[0]).toBe('https://acme.openai.azure.com/openai/v1')
    expect(call[3].model).toBe('gpt-4o')
    expect(call[5]).toBe('api-key')
  })
  it('refuses a stored Azure address that is not an Azure host', async () => {
    mocks.read.mockResolvedValue({ settings: { connections: [{ id: 'owned', providerType: 'azure', baseUrl: 'https://evil.example/openai/v1' }], models: [] }, credentials: { owned: 'azure-key' } })
    mocks.request.mockClear()
    const handler = await load({ connectionId: 'owned', deployments: ['gpt-4o'] })
    await expect(handler(event())).rejects.toMatchObject({ statusCode: 502 })
    expect(mocks.request).not.toHaveBeenCalled()
  })
  it('discovers only candidate chat models and never returns credentials', async () => {
    mocks.request.mockResolvedValue({ data: [{ id: 'gpt-4.1' }, { id: 'text-embedding-3-small' }] })
    const handler = await load({ connectionId: 'owned' })
    expect(await handler(event())).toEqual({ modelIds: ['gpt-4.1'] })
    expect(mocks.read).toHaveBeenCalledWith({ organizationId: 'org', userId: 'owner' })
  })
  it('rejects another user connection or model before invoking the provider', async () => {
    mocks.request.mockClear()
    const handler = await load({ connectionId: 'other-user-connection', modelId: 'other-user-model' })
    await expect(handler(event())).rejects.toMatchObject({ statusCode: 404 })
    expect(mocks.request).not.toHaveBeenCalled()
  })
  it('rejects forbidden users and rate limited requests before looking up credentials', async () => {
    mocks.read.mockClear()
    mocks.owner.mockImplementationOnce(() => { throw Object.assign(new Error('Forbidden'), { statusCode: 403 }) })
    const handler = await load({ connectionId: 'owned' })
    await expect(handler(event())).rejects.toMatchObject({ statusCode: 403 })
    mocks.limit.mockResolvedValueOnce({ allowed: false })
    await expect(handler(event())).rejects.toMatchObject({ statusCode: 429 })
    expect(mocks.read).not.toHaveBeenCalled()
  })
  it('preserves prompts and extraction while omitting unrelated request properties', async () => {
    mocks.request.mockResolvedValue({ choices: [{ finish_reason: 'stop', message: { content: '```sql\nSELECT 1\n```' } }] })
    const handler = await load({ modelId: 'model', schema: 'users: id', question: 'Count users', databasePassword: 'never-send-this' })
    expect(await handler(event())).toEqual({ sql: 'SELECT 1' })
    const request = mocks.request.mock.calls.at(-1)!
    expect(request[0]).toBe('https://api.openai.com/v1')
    expect(request[2]).toBe('encrypted-at-rest-key')
    expect(JSON.stringify(request[3])).not.toContain('never-send-this')
    expect(request[3].messages[0].content).toContain('Database dialect: PostgreSQL')
  })
  it('passes large schemas through the server OpenAI route without the browser limit', async () => {
    const schema = 'public.orders.amount numeric\n'.repeat(2000)
    mocks.request.mockResolvedValue({ choices: [{ message: { content: 'SELECT 1' } }] })
    const handler = await load({ modelId: 'model', schema, question: 'Total sales' })
    expect(await handler(event())).toEqual({ sql: 'SELECT 1' })
    expect(mocks.request.mock.calls.at(-1)?.[3].messages[1].content).toContain(schema)
  })
  it('returns clear provider failures without returning secrets', async () => {
    mocks.request.mockRejectedValueOnce(new Error('Authentication failed. Check your API key.'))
    const handler = await load({ connectionId: 'owned' })
    await expect(handler(event())).rejects.toMatchObject({ statusCode: 502, statusMessage: 'Authentication failed. Check your API key.' })
  })
})

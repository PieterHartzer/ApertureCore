import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import type { AISettings } from '../../../shared/types/ai'
import { useAIModels } from '../../../app/composables/useAIModels'
const mocks = vi.hoisted(() => ({ mounted: [] as (() => unknown)[], generate: vi.fn(), stop: vi.fn(), load: vi.fn(), request: vi.fn() }))
vi.mock('vue', async original => ({ ...await original<typeof import('vue')>(), onMounted: (callback: () => unknown) => mocks.mounted.push(callback), onBeforeUnmount: vi.fn() }))
vi.mock('../../../app/composables/useLocalSqlModel', () => ({ useLocalSqlModel: () => ({ selectedModel: ref(''), ready: ref(true), generate: mocks.generate, load: mocks.load, stop: mocks.stop }) }))
vi.mock('../../../shared/utils/ai-provider', async original => ({ ...await original<typeof import('../../../shared/utils/ai-provider')>(), providerRequest: mocks.request }))
const initial = (): AISettings => ({
  connections: [{ id: 'cloud', name: 'Cloud', providerType: 'openai', baseUrl: 'https://api.openai.com/v1', hasApiKey: true, createdAt: '', updatedAt: '' }, { id: 'local', name: 'Local', providerType: 'lmstudio', baseUrl: 'http://localhost:1234/v1', hasApiKey: false, createdAt: '', updatedAt: '' }],
  models: [
    { id: 'openai', modelId: 'gpt-4.1', displayName: 'Cloud', providerConnectionId: 'cloud', providerType: 'openai', isDefault: true, modelType: 'chat', status: 'unknown', capabilities: ['chat'] },
    { id: 'lm', modelId: 'qwen', displayName: 'Qwen', providerConnectionId: 'local', providerType: 'lmstudio', isDefault: false, modelType: 'chat', status: 'unknown', capabilities: ['chat'] },
    { id: 'browser', modelId: 'Qwen-browser', displayName: 'Browser', providerConnectionId: null, providerType: 'webllm', isDefault: false, modelType: 'chat', status: 'unknown', capabilities: ['chat'] }
  ]
})
beforeEach(() => { mocks.mounted = []; mocks.generate.mockReset().mockResolvedValue('SELECT 3'); mocks.request.mockReset(); vi.stubGlobal('$fetch', vi.fn().mockImplementation(async (path, options) => path === '/api/ai/settings' ? options?.method ? { settings: initial() } : initial() : { sql: 'SELECT 1', modelIds: ['gpt-4.1'] })) })
afterEach(() => vi.unstubAllGlobals())
describe('unified SQL generation', () => {
  it('selects the persisted default and sends only schema/question/model to the server', async () => {
    const ai = useAIModels(); await ai.refresh()
    expect(ai.selectedModel.value).toBe('openai')
    expect(await ai.generate('public.users: id', 'Count users', 'postgres')).toBe('SELECT 1')
    expect(vi.mocked($fetch)).toHaveBeenLastCalledWith('/api/ai/provider', expect.objectContaining({ body: { modelId: 'openai', schema: 'public.users: id', question: 'Count users', databaseType: 'postgres' }, signal: expect.any(AbortSignal) }))
    expect(mocks.generate).not.toHaveBeenCalled()
  })
  it('switches providers without persisting a new default or reusing WebLLM', async () => {
    const ai = useAIModels(); await ai.refresh()
    ai.selectedModel.value = 'lm'
    ai.sessionKeys.set('local', 'session-secret')
    mocks.request.mockResolvedValue({ choices: [{ message: { content: '```sql\nSELECT 2\n```' } }] })
    expect(await ai.generate('users: id', 'Count users', 'postgres')).toBe('SELECT 2')
    expect(mocks.request).toHaveBeenCalledWith('http://localhost:1234/v1', 'chat/completions', 'session-secret', expect.objectContaining({ model: 'qwen' }), expect.any(AbortSignal))
    expect(ai.settings.value.models.find(model => model.isDefault)?.id).toBe('openai')
    expect(mocks.generate).not.toHaveBeenCalled()
    ai.selectedModel.value = 'browser'
    await ai.load()
    expect(await ai.generate('users: id', 'Count users', 'postgres')).toBe('SELECT 3')
    expect(mocks.load).toHaveBeenCalled()
    expect(mocks.generate).toHaveBeenCalledWith('users: id', 'Count users', 'postgres')
  })
  it('discards late results after cancelling or switching a model', async () => {
    const ai = useAIModels(); await ai.refresh(); ai.selectedModel.value = 'lm'
    let resolve!: (value: unknown) => void
    mocks.request.mockImplementation(() => new Promise(done => { resolve = done }))
    const pending = ai.generate('users: id', 'Count users', 'postgres')
    ai.selectedModel.value = 'openai'
    resolve({ choices: [{ message: { content: 'SELECT 1' } }] })
    await expect(pending).rejects.toThrow('cancelled')
    expect(ai.active.value).toBe(false)
  })
  it('requires configured models and rejects invalid SQL output', async () => {
    const ai = useAIModels()
    await expect(ai.generate('users: id', 'Count', 'postgres')).rejects.toThrow('Configure and select')
    await ai.refresh(); ai.selectedModel.value = 'lm'
    mocks.request.mockResolvedValue({ choices: [{ message: { content: 'DELETE FROM users' } }] })
    await expect(ai.generate('users: id', 'Count', 'postgres')).rejects.toThrow('SELECT query')
  })
  it('sends large schemas to LM Studio and OpenAI without blocking them with the WebLLM budget', async () => {
    const ai = useAIModels(); await ai.refresh()
    const schema = 'public.orders.amount numeric\n'.repeat(2000)
    ai.selectedModel.value = 'lm'
    mocks.request.mockResolvedValue({ choices: [{ message: { content: 'SELECT 1' } }] })
    expect(await ai.generate(schema, 'Total sales', 'postgres')).toBe('SELECT 1')
    const localRequest = mocks.request.mock.calls.at(-1)!
    expect(localRequest[1]).toBe('chat/completions')
    expect(localRequest[3].model).toBe('qwen')
    expect(localRequest[3].messages[1].content).toContain(schema)
    ai.selectedModel.value = 'openai'
    expect(await ai.generate(schema, 'Total sales', 'postgres')).toBe('SELECT 1')
    expect(vi.mocked($fetch)).toHaveBeenLastCalledWith('/api/ai/provider', expect.objectContaining({ body: { modelId: 'openai', schema, question: 'Total sales', databaseType: 'postgres' } }))
  })
  it('uses the supplied dialect for LM Studio prompts instead of assuming PostgreSQL', async () => {
    const ai = useAIModels(); await ai.refresh(); ai.selectedModel.value = 'lm'
    mocks.request.mockResolvedValue({ choices: [{ message: { content: 'SELECT 1' } }] })
    await ai.generate('[dbo].[events].[date] nvarchar', 'Monthly events', 'mssql')
    expect(mocks.request.mock.calls.at(-1)?.[3].messages[0].content).toContain('Microsoft SQL Server (T-SQL)')
    expect(mocks.request.mock.calls.at(-1)?.[3].messages[1].content).toContain('nvarchar')
  })
  it('retrieves local models in the browser and remote models on the server', async () => {
    const ai = useAIModels(); await ai.refresh()
    mocks.request.mockResolvedValue({ data: [{ id: 'qwen' }] })
    expect(await ai.availableModels('local')).toEqual(['qwen'])
    expect(await ai.availableModels('cloud')).toEqual(['gpt-4.1'])
    await expect(ai.availableModels('other')).rejects.toThrow('Connection not found')
  })
  it('explains expired sessions and clears the error after successful recovery', async () => {
    const ai = useAIModels()
    vi.mocked($fetch).mockRejectedValueOnce({ statusCode: 401 })
    await expect(ai.refresh()).rejects.toMatchObject({ statusCode: 401 })
    expect(ai.sessionExpired.value).toBe(true)
    expect(ai.error.value).toContain('Sign in again')
    expect(ai.checking.value).toBe(false)
    await ai.refresh()
    expect(ai.sessionExpired.value).toBe(false)
    expect(ai.error.value).toBe('')
    expect(ai.selectedModel.value).toBe('openai')
  })

})

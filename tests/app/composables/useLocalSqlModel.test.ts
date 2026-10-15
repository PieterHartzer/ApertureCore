import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useLocalSqlModel } from '../../../app/composables/useLocalSqlModel'
const mocks = vi.hoisted(() => ({ mounted: undefined as undefined | (() => Promise<void>), unmount: undefined as undefined | (() => void), cache: vi.fn(), create: vi.fn(), completion: vi.fn(), terminate: vi.fn() }))
vi.mock('vue', async (original) => ({ ...await original<typeof import('vue')>(), onMounted: (fn: () => Promise<void>) => { mocks.mounted = fn }, onBeforeUnmount: (fn: () => void) => { mocks.unmount = fn } }))
vi.mock('../../../app/utils/load-web-llm', () => ({ loadWebLlm: async () => ({
  prebuiltAppConfig: { model_list: [{ model_id: 'Qwen2.5-Coder-3B-Instruct-q4f16_1-MLC', vram_required_MB: 2000 }] },
  hasModelInCache: mocks.cache,
  MLCEngine: class {
    reload = mocks.create
    unload = mocks.terminate
    interruptGenerate = vi.fn()
    chat = { completions: { create: mocks.completion } }
  }
}) }))

describe('local SQL model lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('window', { isSecureContext: true })
    vi.stubGlobal('navigator', { gpu: {} })
    mocks.cache.mockResolvedValue(true)
    mocks.create.mockResolvedValue(undefined)
    mocks.terminate.mockResolvedValue(undefined)
    mocks.completion.mockResolvedValue({ choices: [{ message: { content: 'SELECT 1' }, finish_reason: 'stop' }] })
  })
  afterEach(() => { mocks.unmount?.(); vi.unstubAllGlobals() })
  it('detects cached models without downloading automatically', async () => {
    const model = useLocalSqlModel()
    await mocks.mounted?.()
    expect(model.selectedCached.value).toBe(true)
    expect(model.ready.value).toBe(false)
    expect(mocks.create).not.toHaveBeenCalled()
  })
  it('loads the runtime, generates SQL locally and releases it on unmount', async () => {
    const model = useLocalSqlModel()
    await mocks.mounted?.()
    await model.load()
    expect(model.ready.value).toBe(true)
    expect(await model.generate('public.orders.total numeric', 'total sales')).toBe('SELECT 1')
    expect(mocks.completion.mock.calls[0]?.[0].messages[1].content).toContain('public.orders.total numeric')
    mocks.unmount?.()
    expect(mocks.terminate).toHaveBeenCalled()
    expect(model.ready.value).toBe(false)
  })
  it('handles unsupported browsers without importing/loading a model', async () => {
    vi.stubGlobal('navigator', {})
    const model = useLocalSqlModel()
    await mocks.mounted?.()
    expect(model.supported.value).toBe(false)
    expect(model.checking.value).toBe(false)
    await model.load()
    expect(mocks.create).not.toHaveBeenCalled()
  })
  it('allows retry after a failed download', async () => {
    const model = useLocalSqlModel()
    await mocks.mounted?.()
    mocks.create.mockRejectedValueOnce(new Error('out of memory'))
    await model.load()
    expect(model.error.value).toContain('out of memory')
    expect(model.loading.value).toBe(false)
    await model.load()
    expect(model.ready.value).toBe(true)
  })
  it('does not mark a cancelled load ready when its promise completes', async () => {
    const model = useLocalSqlModel()
    await mocks.mounted?.()
    let complete!: (value: unknown) => void
    mocks.create.mockImplementation(() => new Promise((resolve) => { complete = resolve }))
    const pending = model.load()
    await vi.waitFor(() => expect(mocks.create).toHaveBeenCalled())
    model.stop()
    complete({ chat: {} })
    await pending
    expect(model.ready.value).toBe(false)
    expect(model.loading.value).toBe(false)
  })
  it('rejects incomplete generated SQL', async () => {
    const model = useLocalSqlModel()
    await mocks.mounted?.()
    await model.load()
    mocks.completion.mockResolvedValue({ choices: [{ message: { content: 'SELECT' }, finish_reason: 'length' }] })
    await expect(model.generate('orders', 'sales')).rejects.toThrow('cut short')
    expect(model.generating.value).toBe(false)
  })
})

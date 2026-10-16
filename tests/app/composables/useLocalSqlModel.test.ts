import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useLocalSqlModel } from '../../../app/composables/useLocalSqlModel'

const mocks = vi.hoisted(() => ({
  mounted: undefined as undefined | (() => Promise<void>),
  report: undefined as undefined | ((report: { progress: number, text: string }) => void),
  reload: vi.fn(), unload: vi.fn(), cache: vi.fn(), runtime: vi.fn(), completion: vi.fn(), interrupt: vi.fn()
}))
vi.mock('vue', async (original) => ({
  ...await original<typeof import('vue')>(),
  onMounted: (callback: () => Promise<void>) => { mocks.mounted = callback },
  onBeforeUnmount: vi.fn()
}))
vi.mock('../../../app/utils/load-web-llm', () => ({ loadWebLlm: mocks.runtime }))

describe('local model loading', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('window', { isSecureContext: true })
    vi.stubGlobal('navigator', { gpu: {} })
    mocks.reload.mockReset().mockResolvedValue(undefined)
    mocks.unload.mockReset().mockResolvedValue(undefined)
    mocks.cache.mockReset().mockResolvedValue(false)
    mocks.completion.mockReset().mockResolvedValue({ choices: [{ message: { content: 'SELECT 1' }, finish_reason: 'stop' }] })
    mocks.runtime.mockReset().mockResolvedValue({
      prebuiltAppConfig: { model_list: [{ model_id: 'Qwen2.5-Coder-3B-Instruct-q4f16_1-MLC' }] },
      hasModelInCache: mocks.cache,
      MLCEngine: class {
        constructor(options: { initProgressCallback: typeof mocks.report }) { mocks.report = options.initProgressCallback }
        reload = mocks.reload
        unload = mocks.unload
        interruptGenerate = mocks.interrupt
        chat = { completions: { create: mocks.completion } }
      }
    })
  })
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

  it('lists compatible models and reports progress until initialization completes', async () => {
    const model = useLocalSqlModel()
    await mocks.mounted!()
    expect(model.models.value).toHaveLength(1)
    mocks.reload.mockImplementation(async () => {
      mocks.report!({ progress: 0.42, text: 'Fetching weights' })
      expect(model.loading.value).toBe(true)
      expect(model.progress.value).toBe(42)
      expect(model.status.value).toBe('Downloading and initializing the local model…')
      mocks.report!({ progress: NaN, text: '' })
      expect(model.progress.value).toBe(0)
    })
    await model.load()
    expect(model.ready.value).toBe(true)
    expect(model.loading.value).toBe(false)
    expect(model.progress.value).toBe(100)
  })

  it('shows cache, download and cleanup failures without rejecting load', async () => {
    const model = useLocalSqlModel()
    mocks.cache.mockRejectedValue('Storage blocked')
    await mocks.mounted!()
    expect(model.error.value).toContain('Storage blocked')
    mocks.reload.mockRejectedValue('Network offline')
    mocks.unload.mockRejectedValue(new Error('Device lost'))
    await expect(model.load()).resolves.toBeUndefined()
    await Promise.resolve()
    expect(model.error.value).toContain('Network offline')
    expect(model.error.value).toContain('Device lost')
    expect(model.loading.value).toBe(false)
    expect(model.ready.value).toBe(false)
  })

  it('ignores late progress after cancellation', async () => {
    const model = useLocalSqlModel()
    await mocks.mounted!()
    mocks.reload.mockImplementation(async () => {
      model.stop()
      mocks.report!({ progress: 0.9, text: 'Late progress' })
    })
    await model.load()
    expect(model.loading.value).toBe(false)
    expect(model.ready.value).toBe(false)
    expect(model.status.value).toBe('')
  })

  it('allows a valid download to remain inactive for several minutes', async () => {
    const model = useLocalSqlModel()
    await mocks.mounted!()
    mocks.reload.mockImplementation(async () => { await vi.advanceTimersByTimeAsync(120_000) })
    await model.load()
    expect(model.error.value).toBe('')
    expect(model.loading.value).toBe(false)
    expect(model.ready.value).toBe(true)
  })
  it('generates with the loaded engine and rejects use after selecting a different model', async () => {
    const model = useLocalSqlModel()
    await mocks.mounted!(); await model.load()
    expect(await model.generate('users: id', 'Count users')).toBe('SELECT 1')
    model.selectedModel.value = 'another-model'
    await expect(model.generate('users: id', 'Count users')).rejects.toThrow('Load a model first')
  })

  it('retains the browser context guard before starting engine inference', async () => {
    const model = useLocalSqlModel()
    await mocks.mounted!(); await model.load()
    await expect(model.generate('x'.repeat(12001), 'Count users')).rejects.toThrow('browser model')
    expect(mocks.completion).not.toHaveBeenCalled()
    expect(model.generating.value).toBe(false)
  })

  it('interrupts inference and rejects late SQL after cancellation', async () => {
    const model = useLocalSqlModel()
    await mocks.mounted!(); await model.load()
    mocks.completion.mockImplementation(async () => {
      model.stop()
      return { choices: [{ message: { content: 'SELECT 1' } }] }
    })
    await expect(model.generate('users: id', 'Count users')).rejects.toThrow('cancelled')
    expect(mocks.interrupt).toHaveBeenCalled()
    expect(model.generating.value).toBe(false)
  })

})

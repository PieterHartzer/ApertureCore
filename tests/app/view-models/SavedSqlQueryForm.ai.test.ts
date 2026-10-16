import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, effectScope, reactive, ref, type Ref } from 'vue'
import type { AISettings } from '../../../shared/types/ai'
import type { SavedSqlQueryInput } from '../../../app/types/saved-sql-queries'
import component from '../../../app/view-models/components/database/SavedSqlQueryForm'

const mocks = vi.hoisted(() => ({ ai: vi.fn(), generate: vi.fn(), stop: vi.fn(), testQuery: vi.fn() }))
vi.mock('vue', async original => ({ ...await original<typeof import('vue')>(), onBeforeUnmount: vi.fn() }))
vi.mock('~/components/ui/AppAlert.vue', () => ({ default: {} }))
vi.mock('~/composables/useAIModels', () => ({ useAIModels: mocks.ai }))
vi.mock('~/composables/database/useSavedSqlQueryTest', () => ({ useSavedSqlQueryTest: () => ({ testQuery: mocks.testQuery }) }))
vi.mock('~/composables/ui/useNotifications', () => ({ useNotifications: () => ({ success: vi.fn() }) }))

interface FormState {
  query: Ref<SavedSqlQueryInput>
  question: Ref<string>
  selectedModel: Ref<string>
  ready: Ref<boolean>
  canGenerate: Ref<boolean>
  canSubmit: Ref<boolean>
  generatingSql: Ref<boolean>
  modelGroups: Ref<{ label: string }[]>
  selectedConnection: Ref<{ id: string, name: string } | undefined>
  sessionApiKey: Ref<string>
  schemaError: Ref<string>
  sessionExpired: Ref<boolean>
  generateSql(): Promise<void>
  stopModel(): void
  onTest(): Promise<void>
  onSubmit(): void
}
const makeAI = () => {
  const settings = ref<AISettings>({ connections: [{ id: 'lm-connection', providerType: 'lmstudio', name: 'Office LM Studio', baseUrl: 'http://localhost:1234/v1', hasApiKey: false, createdAt: '', updatedAt: '' }], models: [{ id: 'lm-model', providerType: 'lmstudio', providerConnectionId: 'lm-connection', modelId: 'qwen-coder', displayName: 'Qwen', isDefault: true, modelType: 'chat', status: 'unknown', capabilities: ['chat'] }] })
  const selectedModel = ref('lm-model')
  return {
    settings, selectedModel,
    selected: computed(() => settings.value.models.find(model => model.id === selectedModel.value)),
    connectionFor: () => settings.value.connections[0],
    local: { loading: ref(false), supported: ref(false), selectedCached: ref(false), progress: ref(0), status: ref(''), error: ref('') },
    ready: ref(true), checking: ref(false), error: ref(''), sessionExpired: ref(false), sessionKeys: new Map<string, string>(),
    generate: mocks.generate, load: vi.fn(), stop: mocks.stop, refresh: vi.fn()
  }
}
let ai: ReturnType<typeof makeAI>
const scopes: ReturnType<typeof effectScope>[] = []
const setupForm = () => {
  const scope = effectScope(); scopes.push(scope)
  const emit = vi.fn()
  const props = reactive({ mode: 'edit', initialQuery: { queryName: 'Users', connectionId: 'database-1', sql: 'SELECT 0' }, connections: [{ label: 'Database', value: 'database-1' }], isSubmitting: false })
  const form = scope.run(() => component.setup!(props as never, { emit } as never)) as FormState
  return { form, emit }
}
beforeEach(() => {
  ai = makeAI(); mocks.ai.mockReturnValue(ai)
  mocks.generate.mockReset().mockResolvedValue('SELECT count(*) FROM users')
  mocks.stop.mockClear()
  vi.stubGlobal('useI18n', () => ({ t: (key: string) => key }))
  vi.stubGlobal('$fetch', vi.fn().mockResolvedValue({ ok: true, databaseType: 'postgres', schema: 'users: id', columnCount: 1 }))
})
afterEach(() => { scopes.splice(0).forEach(scope => scope.stop()); vi.unstubAllGlobals() })

describe('saved-query form AI integration', () => {
  it('exposes configured providers and allows remote inference without WebGPU', async () => {
    const { form } = setupForm()
    expect(form.modelGroups.value.map(group => group.label)).toEqual(['LM Studio'])
    expect(form.selectedConnection.value?.name).toBe('Office LM Studio')
    form.question.value = 'How many users?'
    expect(form.canGenerate.value).toBe(true)
    await form.generateSql()
    expect(mocks.generate).toHaveBeenCalledWith('users: id', 'How many users?', 'postgres')
    expect(form.query.value.sql).toBe('SELECT count(*) FROM users')
    expect(mocks.testQuery).not.toHaveBeenCalled()
    expect(form.canSubmit.value).toBe(false)
  })
  it('passes optional LM Studio keys only to the in-memory session map', () => {
    const { form } = setupForm()
    form.sessionApiKey.value = 'local-session-key'
    expect(ai.sessionKeys.get('lm-connection')).toBe('local-session-key')
    expect(form.query.value).not.toHaveProperty('apiKey')
    expect(JSON.stringify(ai.settings.value)).not.toContain('local-session-key')
  })
  it('cancels before inference if schema retrieval is still pending', async () => {
    const { form } = setupForm()
    let resolve!: (value: unknown) => void
    vi.mocked($fetch).mockImplementationOnce(() => new Promise(done => { resolve = done }) as never)
    form.question.value = 'Count users'
    const pending = form.generateSql()
    form.stopModel()
    resolve({ ok: true, databaseType: 'postgres', schema: 'users: id', columnCount: 1 })
    await pending
    expect(mocks.generate).not.toHaveBeenCalled()
    expect(form.query.value.sql).toBe('SELECT 0')
    expect(form.generatingSql.value).toBe(false)
  })
  it('discards late SQL when the selected model changes', async () => {
    const { form } = setupForm()
    let resolve!: (sql: string) => void
    let started!: () => void
    const inferenceStarted = new Promise<void>(done => { started = done })
    mocks.generate.mockImplementationOnce(() => {
      started()
      return new Promise(done => { resolve = done })
    })
    form.question.value = 'Count users'
    const pending = form.generateSql()
    await inferenceStarted
    form.selectedModel.value = 'another-model'
    resolve('SELECT 99')
    await pending
    expect(form.query.value.sql).toBe('SELECT 0')
  })
  it('offers reauthentication for a schema 401 without sending AI requests or losing the draft', async () => {
    const { form } = setupForm()
    vi.mocked($fetch).mockRejectedValueOnce(Object.assign(new Error('[GET] schema: 401 Unauthorized'), { statusCode: 401 }))
    form.question.value = 'Count users'
    await form.generateSql()
    expect(form.sessionExpired.value).toBe(true)
    expect(form.schemaError.value).toContain('Sign in again in a new tab')
    expect(form.query.value.sql).toBe('SELECT 0')
    expect(form.question.value).toBe('Count users')
    expect(mocks.generate).not.toHaveBeenCalled()
    await form.generateSql()
    expect(form.sessionExpired.value).toBe(false)
    expect(form.query.value.sql).toBe('SELECT count(*) FROM users')
  })
  it('shows schema failures and leaves manual SQL intact', async () => {
    const { form } = setupForm()
    vi.mocked($fetch).mockResolvedValueOnce({ ok: false, message: 'Database offline' } as never)
    form.question.value = 'Count users'
    await form.generateSql()
    expect(form.schemaError.value).toBe('Database offline')
    expect(form.query.value.sql).toBe('SELECT 0')
    expect(mocks.generate).not.toHaveBeenCalled()
  })
})

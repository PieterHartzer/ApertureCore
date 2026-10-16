import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { AISettings, AIModel, AIGenerationRequest, AIInferenceProvider, AISqlDialect } from '../../shared/types/ai'
import { providerRequest, chatModelIds } from '#shared/utils/ai-provider'
import { buildSqlPrompt, extractGeneratedSql } from '../utils/sql-assistant'
import { useLocalSqlModel } from './useLocalSqlModel'
export const useAIModels = () => {
  const settings = ref<AISettings>({ connections: [], models: [] })
  const selectedModel = ref('')
  const error = ref('')
  const checking = ref(true)
  const sessionExpired = ref(false)
  const active = ref(false)
  const connectionStatus = ref<Record<string, string>>({})
  const local = useLocalSqlModel()
  const sessionKeys = new Map<string, string>()
  let controller: AbortController | undefined
  const selected = computed(() => settings.value.models.find(model => model.id === selectedModel.value))
  const connectionFor = (model: AIModel) => settings.value.connections.find(connection => connection.id === model.providerConnectionId)
  const refresh = async () => {
    checking.value = true
    try {
      const response = await $fetch<AISettings>('/api/ai/settings')
      if (!Array.isArray(response.models) || !Array.isArray(response.connections)) throw new Error('Invalid AI settings response.')
      settings.value = response
      error.value = ''
      sessionExpired.value = false
      if (!settings.value.models.some(model => model.id === selectedModel.value)) selectedModel.value = settings.value.models.find(model => model.isDefault)?.id ?? settings.value.models[0]?.id ?? ''
    } catch (cause) {
      const failure = cause as { statusCode?: number, status?: number, response?: { status?: number } }
      const status = failure.statusCode ?? failure.status ?? failure.response?.status
      sessionExpired.value = status === 401
      error.value = status === 401
        ? 'Your session has expired. Sign in again to load your AI settings.'
        : status === 403
          ? 'AI settings require an authenticated account with an organization. Check your account and organization claim configuration.'
          : 'Could not load AI settings. Check the application database, migrations and encryption key, then retry.'
      throw cause
    } finally { checking.value = false }
  }
  const update = async (body: Record<string, unknown>) => {
    const result = await $fetch<{ settings: AISettings, connectionId?: string }>('/api/ai/settings', { method: 'POST', body })
    settings.value = result.settings
    if (!settings.value.models.some(model => model.id === selectedModel.value)) selectedModel.value = settings.value.models.find(model => model.isDefault)?.id ?? ''
    return result.connectionId
  }
  const availableModels = async (connectionId: string) => {
    const connection = settings.value.connections.find(item => item.id === connectionId)
    if (!connection) throw new Error('Connection not found.')
    try {
      const ids = connection.providerType === 'openai'
        ? (await $fetch<{ modelIds: string[] }>('/api/ai/provider', { method: 'POST', body: { connectionId } })).modelIds
        : chatModelIds((await providerRequest(connection.baseUrl, 'models', sessionKeys.get(connectionId))).data ?? [], false)
      connectionStatus.value[connectionId] = 'Connected · model discovery successful'
      return ids
    } catch (cause) {
      connectionStatus.value[connectionId] = 'Unavailable · test connection or edit settings'
      throw cause
    }
  }
  const stop = () => { controller?.abort(); local.stop(); active.value = false }
  watch(selectedModel, () => {
    stop()
    if (selected.value?.providerType === 'webllm') local.selectedModel.value = selected.value.modelId
  }, { flush: 'sync' })
  const providers: Record<AIModel['providerType'], AIInferenceProvider> = {
    webllm: { generate: request => {
      if (local.selectedModel.value !== request.model.modelId) throw new Error('Load the selected browser model first.')
      return local.generate(request.schema, request.question, request.databaseType)
    } },
    openai: { generate: async request => {
      const response = await $fetch<{ sql: string }>('/api/ai/provider', { method: 'POST', body: { modelId: request.model.id, schema: request.schema, question: request.question, databaseType: request.databaseType }, signal: request.signal, retry: 0 })
      return response.sql
    } },
    lmstudio: { generate: async request => {
      const connection = connectionFor(request.model)
      if (!connection) throw new Error('Connection removed. Choose another model.')
      const response = await providerRequest(connection.baseUrl, 'chat/completions', sessionKeys.get(connection.id), { model: request.model.modelId, messages: buildSqlPrompt(request.schema, request.question, { databaseType: request.databaseType }), temperature: request.options?.temperature ?? 0, max_tokens: request.options?.maxTokens ?? 1024 }, request.signal)
      if (response.choices?.[0]?.finish_reason === 'length') throw new Error('Generated SQL was cut short. Ask a simpler question.')
      return extractGeneratedSql(response.choices?.[0]?.message?.content ?? '')
    } }
  }
  const generate = async (schema: string, question: string, databaseType: AISqlDialect) => {
    const model = selected.value
    if (!model) throw new Error('Configure and select an AI model in Settings → AI Models.')
    if (!databaseType) throw new Error('Read the database schema again to identify its SQL dialect.')
    buildSqlPrompt(schema, question, { databaseType })
    controller = new AbortController()
    const signal = controller.signal
    active.value = true
    try {
      const result = await providers[model.providerType].generate({ model, schema, question, databaseType, signal } as AIGenerationRequest)
      if (signal.aborted) throw new Error('Generation cancelled.')
      return result
    } finally { if (controller?.signal === signal) active.value = false }
  }
  const load = async () => {
    if (selected.value?.providerType !== 'webllm') return
    local.selectedModel.value = selected.value.modelId
    await local.load()
  }
  onMounted(() => { void refresh().catch(() => undefined) })
  onBeforeUnmount(stop)
  const ready = computed(() => !!selected.value && (selected.value.providerType !== 'webllm' || local.ready.value))
  return { settings, selectedModel, selected, connectionFor, refresh, update, availableModels, sessionKeys, connectionStatus, error, checking, sessionExpired, active, local, ready, generate, load, stop }
}

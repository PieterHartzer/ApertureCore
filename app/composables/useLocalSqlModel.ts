import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { AISqlDialect } from '../../shared/types/ai'
import type { MLCEngine } from '@mlc-ai/web-llm'
import { loadWebLlm } from '../utils/load-web-llm'
import { buildSqlPrompt, extractGeneratedSql, WEBLLM_SQL_INPUT_CHARACTER_LIMIT } from '../utils/sql-assistant'

export const useLocalSqlModel = () => {
  const models = ref<{ label: string, value: string, cached: boolean }[]>([])
  const selectedModel = ref('Qwen2.5-Coder-3B-Instruct-q4f16_1-MLC')
  const readyModel = ref('')
  const checking = ref(true)
  const loading = ref(false)
  const generating = ref(false)
  const supported = ref(false)
  const progress = ref(0)
  const status = ref('')
  const error = ref('')
  let engine: MLCEngine | undefined
  let disposed = false
  let operation = 0
  const ready = computed(() => readyModel.value === selectedModel.value && !!engine)
  const selectedCached = computed(() => models.value.find((model) => model.value === selectedModel.value)?.cached ?? false)

  const describeError = (cause: unknown) => cause instanceof Error ? cause.message : typeof cause === 'string' ? cause : 'An unexpected error occurred.'
  const showCleanupError = (cause: unknown) => {
    if (!disposed) error.value = [error.value, `Could not release the local model: ${describeError(cause)}`].filter(Boolean).join(' ')
  }

  const stop = () => {
    operation++
    const previousEngine = engine
    engine = undefined
    try { previousEngine?.interruptGenerate() } catch (cause) { showCleanupError(cause) }
    try { void previousEngine?.unload().catch(showCleanupError) } catch (cause) { showCleanupError(cause) }
    readyModel.value = ''
    loading.value = false
    generating.value = false
    status.value = ''
  }

  onMounted(async () => {
    try {
      supported.value = window.isSecureContext && 'gpu' in navigator
      if (!supported.value) return
      const lib = await loadWebLlm()
      const records = lib.prebuiltAppConfig.model_list.filter((model) => /^Qwen2\.5-Coder-(0\.5|1\.5|3|7)B-Instruct-q4f(16|32)_1-MLC$/.test(model.model_id))
      const options = await Promise.all(records.map(async (model) => {
        let cached = false
        try { cached = await lib.hasModelInCache(model.model_id) } catch (cause) {
          if (!disposed) error.value = `Could not check the browser model cache. You can still try loading a model. ${describeError(cause)}`
        }
        return {
          value: model.model_id,
          cached,
          label: `${model.model_id.replace('-Instruct-', ' · ').replace('-MLC', '')} · ~${Math.round(model.vram_required_MB ?? 0)} MB GPU${cached ? ' · cached' : ''}`
        }
      }))
      if (disposed) return
      if (!options.length) throw new Error('No compatible models were found in the model catalogue.')
      models.value = options
      selectedModel.value = options.find((model) => model.cached)?.value ?? selectedModel.value
    } catch (cause) {
      if (disposed) return
      error.value = `Could not load the model catalogue. Reload this page to retry. Manual SQL is still available. ${describeError(cause)}`
    } finally {
      if (!disposed) checking.value = false
    }
  })

  const load = async () => {
    if (loading.value || generating.value || !supported.value) return
    error.value = ''
    stop()
    const current = operation
    const id = selectedModel.value
    loading.value = true
    progress.value = 0
    status.value = 'Starting local model. Connecting to the model download host…'
    try {
      const { MLCEngine } = await loadWebLlm()
      if (disposed || current !== operation) return
      const localEngine = new MLCEngine({
        initProgressCallback: (report) => {
          if (current !== operation || disposed) return
          progress.value = Number.isFinite(report.progress) ? Math.min(100, Math.max(0, Math.round(report.progress * 100))) : 0
          status.value = report.progress >= 1 ? 'Loading model…' : 'Downloading and initializing the local model…'
        }
      })
      engine = localEngine
      await localEngine.reload(id, { context_window_size: 8192 })
      if (disposed || current !== operation) { await localEngine.unload(); return }
      progress.value = 100
      readyModel.value = id
      const cached = await (await loadWebLlm()).hasModelInCache(id)
      if (disposed || current !== operation) return
      models.value = models.value.map((model) => model.value === id ? { ...model, cached } : model)
      status.value = 'Model ready. Questions and schema are processed in this browser.'
    } catch (cause) {
      if (disposed || current !== operation) return
      error.value = `Could not load this model. Try a smaller model or a q4f32 variant if your GPU lacks float16 support. ${describeError(cause)}`
      stop()
    } finally {
      if (current === operation) loading.value = false
    }
  }

  const generate = async (schema: string, question: string, databaseType: AISqlDialect = 'postgres') => {
    if (!ready.value || !engine || generating.value) throw new Error('Load a model first.')
    const current = operation
    generating.value = true
    error.value = ''
    try {
      const reply = await engine.chat.completions.create({
        messages: buildSqlPrompt(schema, question, { maxInputCharacters: WEBLLM_SQL_INPUT_CHARACTER_LIMIT, databaseType }), temperature: 0, max_tokens: 1024
      })
      if (disposed || current !== operation) throw new Error('Generation cancelled.')
      if (reply.choices[0]?.finish_reason === 'length') throw new Error('The generated SQL was cut short. Ask a simpler question.')
      return extractGeneratedSql(reply.choices[0]?.message.content ?? '')
    } catch (cause) {
      if (!disposed && current === operation) error.value = `Could not generate SQL. ${describeError(cause)}`
      throw cause
    } finally {
      if (current === operation) generating.value = false
    }
  }

  const deleteDownload = async (id: string) => {
    if (readyModel.value === id || selectedModel.value === id) stop()
    const lib = await loadWebLlm()
    await lib.deleteModelAllInfoInCache(id)
    const cached = await lib.hasModelInCache(id)
    models.value = models.value.map(model => model.value === id ? { ...model, cached } : model)
  }

  onBeforeUnmount(() => { disposed = true; stop() })
  return { models, readyModel, selectedModel, selectedCached, ready, checking, loading, generating, supported, progress, status, error, load, generate, stop, deleteDownload }
}

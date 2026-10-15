import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { MLCEngine } from '@mlc-ai/web-llm'
import { loadWebLlm } from '../utils/load-web-llm'
import { buildSqlPrompt, extractGeneratedSql } from '../utils/sql-assistant'

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
  let loadingTimeout: ReturnType<typeof setTimeout> | undefined
  let disposed = false
  let operation = 0
  const ready = computed(() => readyModel.value === selectedModel.value && !!engine)
  const selectedCached = computed(() => models.value.find((model) => model.value === selectedModel.value)?.cached ?? false)

  const stop = () => {
    operation++
    clearTimeout(loadingTimeout)
    engine?.interruptGenerate()
    void engine?.unload().catch(() => {})
    engine = undefined
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
        const cached = await lib.hasModelInCache(model.model_id).catch(() => false)
        return {
          value: model.model_id,
          cached,
          label: `${model.model_id.replace('-Instruct-', ' · ').replace('-MLC', '')} · ~${Math.round(model.vram_required_MB ?? 0)} MB GPU${cached ? ' · cached' : ''}`
        }
      }))
      if (disposed) return
      models.value = options
      selectedModel.value = options.find((model) => model.cached)?.value ?? selectedModel.value
    } catch (cause) {
      error.value = `Could not load the model catalogue. Reload this page to retry. Manual SQL is still available. ${cause instanceof Error ? cause.message : ''}`
    } finally {
      if (!disposed) checking.value = false
    }
  })

  const load = async () => {
    if (loading.value || generating.value || !supported.value) return
    stop()
    const current = operation
    const id = selectedModel.value
    loading.value = true
    error.value = ''
    progress.value = 0
    status.value = 'Starting local model. Connecting to the model download host…'
    const resetTimeout = () => {
      clearTimeout(loadingTimeout)
      loadingTimeout = setTimeout(() => {
        if (current !== operation || disposed) return
        stop()
        error.value = 'Model loading stopped responding. Check your internet connection and retry, or choose a smaller model.'
      }, 120_000)
    }
    resetTimeout()
    try {
      const { MLCEngine } = await loadWebLlm()
      if (disposed || current !== operation) return
      const localEngine = new MLCEngine({
        initProgressCallback: (report) => {
          if (current !== operation || disposed) return
          resetTimeout()
          progress.value = Math.round(report.progress * 100)
          status.value = report.text
        }
      })
      engine = localEngine
      await localEngine.reload(id, { context_window_size: 8192 })
      if (disposed || current !== operation) return
      clearTimeout(loadingTimeout)
      readyModel.value = id
      models.value = models.value.map((model) => model.value === id ? { ...model, cached: true } : model)
      status.value = 'Model ready. Questions and schema are processed in this browser.'
    } catch (cause) {
      if (disposed || current !== operation) return
      stop()
      error.value = `Could not load this model. Try a smaller model or a q4f32 variant if your GPU lacks float16 support. ${cause instanceof Error ? cause.message : ''}`
    } finally {
      if (current === operation) loading.value = false
    }
  }

  const generate = async (schema: string, question: string) => {
    if (!ready.value || !engine || generating.value) throw new Error('Load a model first.')
    const current = operation
    generating.value = true
    try {
      const reply = await engine.chat.completions.create({
        messages: buildSqlPrompt(schema, question), temperature: 0, max_tokens: 1024
      })
      if (disposed || current !== operation) throw new Error('Generation cancelled.')
      if (reply.choices[0]?.finish_reason === 'length') throw new Error('The generated SQL was cut short. Ask a simpler question.')
      return extractGeneratedSql(reply.choices[0]?.message.content ?? '')
    } finally {
      if (current === operation) generating.value = false
    }
  }

  onBeforeUnmount(() => { disposed = true; stop() })
  return { models, selectedModel, selectedCached, ready, checking, loading, generating, supported, progress, status, error, load, generate, stop }
}

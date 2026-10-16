import type { AISqlDialect } from '../../../../shared/types/ai'
import { computed, defineComponent, onBeforeUnmount, ref, watch, type PropType } from 'vue'

import AppAlert from '~/components/ui/AppAlert.vue'
import { useSavedSqlQueryTest } from '~/composables/database/useSavedSqlQueryTest'
import { useNotifications } from '~/composables/ui/useNotifications'
import { useAIModels } from '~/composables/useAIModels'
import type {
  SavedSqlQueryConnectionOption,
  SavedSqlQueryInput,
  SavedSqlQueryResultRow
} from '~/types/saved-sql-queries'
import { createEmptySavedSqlQueryInput } from '~/types/saved-sql-queries'
import { translateMessage } from '~/utils/translateMessage'
import { getRequestStatus, SESSION_EXPIRED_MESSAGE } from '~/utils/request-status'

export default defineComponent({
  components: {
    AppAlert
  },
  props: {
    mode: {
      type: String as PropType<'create' | 'edit'>,
      default: 'create'
    },
    initialQuery: {
      type: Object as PropType<SavedSqlQueryInput | null>,
      default: null
    },
    connections: {
      type: Array as PropType<SavedSqlQueryConnectionOption[]>,
      required: true
    },
    isSubmitting: {
      type: Boolean,
      default: false
    },
    submitLabel: {
      type: String,
      required: true
    },
    submitLoadingLabel: {
      type: String,
      required: true
    },
    testLabel: {
      type: String,
      required: true
    },
    testLoadingLabel: {
      type: String,
      required: true
    },
    cancelLabel: {
      type: String,
      required: true
    },
    errorMessage: {
      type: String,
      default: ''
    },
    errorTitle: {
      type: String,
      default: ''
    }
  },
  emits: ['submit', 'cancel'],
  setup(props, { emit }) {
    const { t } = useI18n()
    const { success } = useNotifications()
    const { testQuery } = useSavedSqlQueryTest()
    const ai = useAIModels()
    const { selectedModel, selected, checking, ready, load, generate, stop } = ai
    const { loading, supported, selectedCached, progress, status } = ai.local
    const modelError = computed(() => ai.error.value || (selected.value?.providerType === 'webllm' ? ai.local.error.value : ''))
    const modelGroups = computed(() => ['openai', 'lmstudio', 'webllm'].map(providerType => ({
      label: providerType === 'openai' ? 'OpenAI' : providerType === 'lmstudio' ? 'LM Studio' : 'Browser Models',
      models: ai.settings.value.models.filter(model => model.providerType === providerType)
    })).filter(group => group.models.length))
    const selectedConnection = computed(() => selected.value ? ai.connectionFor(selected.value) : undefined)
    const sessionApiKey = ref('')

    const DEFAULT_QUERY_TEST_RESULT_SAMPLE_ROW_LIMIT = 25
    const query = ref(createEmptySavedSqlQueryInput())
    const isTesting = ref(false)
    const testErrorMessage = ref('')
    const testErrorDetails = ref('')
    const lastTestedQuerySignature = ref<string | null>(null)
    const testResult = ref<{
      columns: string[]
      rows: SavedSqlQueryResultRow[]
      rowLimit: number
    } | null>(null)
    const question = ref('')
    const generatingSql = ref(false)
    const schema = ref('')
    const schemaDatabaseType = ref<AISqlDialect>()
    const schemaLoaded = ref(false)
    const schemaLoading = ref(false)
    const schemaError = ref('')
    const requestSessionExpired = ref(false)
    const sessionExpired = computed(() => ai.sessionExpired.value || requestSessionExpired.value)
    let revision = 0

    const buildTestSignature = (
      value: Pick<SavedSqlQueryInput, 'connectionId' | 'sql'>
    ) => {
      return JSON.stringify({
        connectionId: value.connectionId.trim(),
        sql: value.sql
      })
    }

    const currentQueryTestSignature = computed(() => {
      return buildTestSignature(query.value)
    })

    const isFormValid = computed(() => {
      return (
        props.connections.length > 0 &&
        Boolean(query.value.queryName.trim()) &&
        Boolean(query.value.connectionId.trim()) &&
        Boolean(query.value.sql.trim())
      )
    })

    const canTest = computed(() => {
      return (
        !props.isSubmitting &&
        !isTesting.value &&
        props.connections.length > 0 &&
        Boolean(query.value.connectionId.trim()) &&
        Boolean(query.value.sql.trim())
      )
    })

    const canSubmit = computed(() => {
      return (
        !props.isSubmitting &&
        !isTesting.value &&
        isFormValid.value &&
        lastTestedQuerySignature.value === currentQueryTestSignature.value
      )
    })

    const canGenerate = computed(() => {
      return !props.isSubmitting && !isTesting.value && !generatingSql.value && ready.value && Boolean(query.value.connectionId) && Boolean(question.value.trim())
    })

    const loadSchema = async () => {
      if (!query.value.connectionId) {
        throw new Error('Select a database connection first.')
      }
      const current = revision
      schemaLoading.value = true
      schema.value = ''
      schemaLoaded.value = false
      schemaError.value = ''
      try {
        const response = await $fetch<{ ok: boolean, schema: string, databaseType: AISqlDialect, columnCount: number, message?: string }>(
          `/api/connections/${encodeURIComponent(query.value.connectionId)}/schema`,
          { retry: 0 }
        )
        if (current !== revision) {
          throw new Error('The selected connection changed. Try again.')
        }
        if (!response.ok) {
          throw new Error(response.message || 'Could not read the schema.')
        }
        requestSessionExpired.value = false
        if (!response.databaseType) throw new Error('Database dialect is missing. Reload the page and read the schema again.')
        schemaDatabaseType.value = response.databaseType
        schema.value = response.schema
        schemaLoaded.value = true
        return response.schema
      } catch (cause) {
        if (current === revision) {
          requestSessionExpired.value = getRequestStatus(cause) === 401
          schemaError.value = requestSessionExpired.value ? SESSION_EXPIRED_MESSAGE : cause instanceof Error ? cause.message : 'Could not read the database schema.'
        }
        throw cause
      } finally {
        schemaLoading.value = false
      }
    }

    const loadModel = async () => {
      if (loading.value || generatingSql.value) return
      await load()
    }

    const stopModel = () => {
      revision++
      stop()
    }
    watch(selectedModel, () => {
      revision++
      sessionApiKey.value = ''
    }, { flush: 'sync' })
    watch(sessionApiKey, value => {
      if (selectedConnection.value?.providerType === 'lmstudio') ai.sessionKeys.set(selectedConnection.value.id, value)
    }, { flush: 'sync' })
    onBeforeUnmount(() => { revision++ })

    const generateSql = async () => {
      if (!canGenerate.value) return
      const current = revision
      generatingSql.value = true
      try {
        const freshSchema = await loadSchema()
        if (current !== revision) return
        if (!schemaDatabaseType.value) throw new Error('Read the database schema first.')
        const generated = await generate(freshSchema, question.value, schemaDatabaseType.value)
        if (current === revision) {
          query.value.sql = generated
          question.value = ''
        }
      } catch (cause) {
        if (current === revision) {
          if (getRequestStatus(cause) === 401) requestSessionExpired.value = true
          const errorMsg = requestSessionExpired.value ? SESSION_EXPIRED_MESSAGE : cause instanceof Error ? cause.message : 'Could not generate SQL.'
          if (!schemaError.value) {
            schemaError.value = errorMsg
          }
        }
      } finally {
        generatingSql.value = false
      }
    }

    const resetForm = (nextQuery: SavedSqlQueryInput) => {
      query.value = {
        ...nextQuery
      }
      lastTestedQuerySignature.value = null
      testErrorMessage.value = ''
      testErrorDetails.value = ''
      testResult.value = null
    }

    watch(
      () => props.initialQuery,
      (value) => {
        resetForm(value ?? createEmptySavedSqlQueryInput())
        question.value = ''
        schema.value = ''
        schemaLoaded.value = false
        schemaError.value = ''
      },
      {
        immediate: true
      }
    )

    watch(() => query.value.connectionId, () => {
      revision++
      stop()
      schema.value = ''
      schemaLoaded.value = false
      schemaError.value = ''
      testResult.value = null
    })

    watch(currentQueryTestSignature, (value, previousValue) => {
      if (!previousValue || value === lastTestedQuerySignature.value) {
        return
      }

      testErrorMessage.value = ''
      testErrorDetails.value = ''
      testResult.value = null
    })

    const resultColumns = computed(() => {
      return (testResult.value?.columns ?? []).map((columnName) => ({
        accessorKey: columnName,
        header: columnName
      }))
    })

    const resultsDescription = computed(() => {
      if (!testResult.value) {
        return ''
      }

      return t('queries.test.results.description', {
        rowLimit: testResult.value.rowLimit
      })
    })

    const onTest = async () => {
      if (!canTest.value) {
        return
      }

      isTesting.value = true
      testErrorMessage.value = ''
      testErrorDetails.value = ''
      testResult.value = null
      lastTestedQuerySignature.value = null

      try {
        const response = await testQuery({
          connectionId: query.value.connectionId.trim(),
          sql: query.value.sql
        })
        const message = translateMessage(
          t,
          response.messageKey,
          response.ok
            ? 'queries.test.success'
            : 'queries.test.errors.unexpected'
        )

        if (response.ok) {
          lastTestedQuerySignature.value = currentQueryTestSignature.value
          testResult.value = {
            columns: response.columns ?? [],
            rows: response.rows ?? [],
            rowLimit: response.rowLimit ?? DEFAULT_QUERY_TEST_RESULT_SAMPLE_ROW_LIMIT
          }
          success(message, t('queries.test.notifications.successTitle'))
          return
        }

        testErrorMessage.value = message
        testErrorDetails.value = response.details ?? ''
      } catch (cause) {
        testErrorMessage.value = cause instanceof Error ? cause.message : String(cause)
      } finally {
        isTesting.value = false
      }
    }

    const onSubmit = () => {
      if (!canSubmit.value) {
        return
      }

      emit('submit', {
        queryName: query.value.queryName.trim(),
        connectionId: query.value.connectionId.trim(),
        sql: query.value.sql
      })
    }

    const onCancel = () => {
      if (props.isSubmitting || isTesting.value) {
        return
      }

      emit('cancel')
    }

    return {
      canGenerate,
      canSubmit,
      canTest,
      checking,
      generatingSql,
      generateSql,
      modelGroups,
      refreshModels: () => { void ai.refresh().catch(() => undefined) },
      sessionExpired,
      selected,
      selectedConnection,
      sessionApiKey,
      isTesting,
      loadModel,
      loading,
      loadSchema,
      modelError,
      onCancel,
      onSubmit,
      onTest,
      progress,
      question,
      query,
      ready,
      resultColumns,
      resultsDescription,
      schema,
      schemaError,
      schemaLoaded,
      schemaLoading,
      selectedCached,
      selectedModel,
      status,
      stopModel,
      supported,
      t,
      testErrorDetails,
      testErrorMessage,
      testResult
    }
  }
})

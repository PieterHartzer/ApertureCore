import { computed, defineComponent, ref, watch, type PropType } from 'vue'

import AppAlert from '~/components/ui/AppAlert.vue'
import { useSavedSqlQueryTest } from '~/composables/database/useSavedSqlQueryTest'
import { useNotifications } from '~/composables/ui/useNotifications'
import type {
  SavedSqlQueryConnectionOption,
  SavedSqlQueryInput,
  SavedSqlQueryResultRow
} from '~/types/saved-sql-queries'
import { createEmptySavedSqlQueryInput } from '~/types/saved-sql-queries'
import { translateMessage } from '~/utils/translateMessage'

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
      },
      {
        immediate: true
      }
    )

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
      canSubmit,
      canTest,
      isTesting,
      onCancel,
      onSubmit,
      onTest,
      query,
      resultColumns,
      resultsDescription,
      t,
      testErrorDetails,
      testErrorMessage,
      testResult
    }
  }
})

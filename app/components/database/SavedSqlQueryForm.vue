<script setup lang="ts">
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

interface Props {
  mode?: 'create' | 'edit'
  initialQuery?: SavedSqlQueryInput | null
  connections: SavedSqlQueryConnectionOption[]
  isSubmitting?: boolean
  submitLabel: string
  submitLoadingLabel: string
  testLabel: string
  testLoadingLabel: string
  cancelLabel: string
  errorMessage?: string
  errorTitle?: string
}

const props = withDefaults(defineProps<Props>(), {
  mode: 'create',
  initialQuery: null,
  isSubmitting: false,
  errorMessage: '',
  errorTitle: ''
})

const emit = defineEmits<{
  submit: [query: SavedSqlQueryInput]
  cancel: []
}>()

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
</script>

<template>
  <UForm
    :state="query"
    class="space-y-6"
    @submit="onSubmit"
  >
    <AppAlert
      v-if="errorMessage"
      kind="error"
      :title="errorTitle"
    >
      {{ errorMessage }}
    </AppAlert>

    <div class="grid gap-6">
      <UFormField
        name="queryName"
        :label="t('queries.form.fields.queryName.label')"
        :description="t('queries.form.fields.queryName.description')"
      >
        <UInput
          v-model="query.queryName"
          :placeholder="t('queries.form.fields.queryName.placeholder')"
          class="w-full"
        />
      </UFormField>

      <UFormField
        name="connectionId"
        :label="t('queries.form.fields.connectionId.label')"
        :description="t('queries.form.fields.connectionId.description')"
      >
        <USelect
          v-model="query.connectionId"
          :items="connections"
          :placeholder="t('queries.form.fields.connectionId.placeholder')"
          class="w-full"
        />
      </UFormField>

      <UFormField
        name="sql"
        :label="t('queries.form.fields.sql.label')"
        :description="t('queries.form.fields.sql.description')"
      >
        <UTextarea
          v-model="query.sql"
          :rows="14"
          :placeholder="t('queries.form.fields.sql.placeholder')"
          class="w-full font-mono"
        />
      </UFormField>
    </div>

    <div class="flex flex-wrap items-center gap-3">
      <UButton
        type="button"
        icon="i-lucide-play"
        :loading="isTesting"
        :disabled="!canTest"
        :label="isTesting ? testLoadingLabel : testLabel"
        @click="onTest"
      />
      <UButton
        type="submit"
        icon="i-lucide-save"
        :loading="isSubmitting"
        :disabled="!canSubmit"
        :label="isSubmitting ? submitLoadingLabel : submitLabel"
      />
      <UButton
        type="button"
        color="neutral"
        variant="soft"
        :disabled="isSubmitting || isTesting"
        :label="cancelLabel"
        @click="onCancel"
      />
    </div>

    <AppAlert
      v-if="testErrorMessage"
      kind="error"
      :title="t('queries.test.notifications.errorTitle')"
    >
      <div class="space-y-2">
        <p>{{ testErrorMessage }}</p>
        <p
          v-if="testErrorDetails"
          class="text-sm whitespace-pre-wrap break-words"
        >
          {{ t('queries.test.errors.details', { details: testErrorDetails }) }}
        </p>
      </div>
    </AppAlert>

    <div
      v-if="testResult"
      class="space-y-3"
    >
      <div class="space-y-1">
        <p class="font-medium">
          {{ t('queries.test.results.title') }}
        </p>
        <p class="text-sm text-muted">
          {{ resultsDescription }}
        </p>
      </div>

      <UTable
        :data="testResult.rows"
        :columns="resultColumns"
        :empty="t('queries.test.results.empty')"
      />
    </div>
  </UForm>
</template>

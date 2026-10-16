<script setup lang="ts">
import type { AISqlDialect } from '../../shared/types/ai'
import WorkspaceStep from '~/components/ui/WorkspaceStep.vue'
import AppAlert from '~/components/ui/AppAlert.vue'
import { useSavedDatabaseConnections } from '~/composables/database/useSavedDatabaseConnections'
import { useSavedSqlQueryTest } from '~/composables/database/useSavedSqlQueryTest'
import { useSavedSqlQuery } from '~/composables/database/useSavedSqlQuery'
import { useSavedSqlQueryUpdate } from '~/composables/database/useSavedSqlQueryUpdate'
import { useSavedSqlQuerySave } from '~/composables/database/useSavedSqlQuerySave'
import { useAIModels } from '~/composables/useAIModels'
import { getRequestStatus, SESSION_EXPIRED_MESSAGE } from '~/utils/request-status'
import type { SavedSqlQueryTestResponse } from '~/types/saved-sql-queries'

definePageMeta({ key: route => String(route.query.queryId ?? 'new') })
const route = useRoute()
const queryId = ref(typeof route.query.queryId === 'string' ? route.query.queryId : '')
const { t } = useI18n()
const requestFetch = import.meta.server ? useRequestFetch() : $fetch
const { listConnections } = useSavedDatabaseConnections(requestFetch)
const { data: connections, refresh: reloadConnections } = await useAsyncData('sql-workspace:connections', listConnections)
const connectionOptions = computed(() => (connections.value?.connections ?? []).map((connection) => ({ label: connection.connectionName, value: connection.id })))
const connectionId = ref(connectionOptions.value[0]?.value ?? '')
const question = ref('')
const sql = ref('')
const queryName = ref('')
const databaseStepOpen = ref(true)
const selectedConnectionName = computed(() => connectionOptions.value.find(option => option.value === connectionId.value)?.label ?? '')
const schema = ref('')
const schemaDatabaseType = ref<AISqlDialect>()
const schemaColumns = ref(0)
const schemaLoaded = ref(false)
const schemaLoading = ref(false)
const generatingSql = ref(false)
const testing = ref(false)
const saving = ref(false)
const error = ref('')
const errorTitle = ref('Could not complete the request')
const schemaError = ref('')
const requestSessionExpired = ref(false)
const saved = ref(false)
const result = ref<SavedSqlQueryTestResponse | null>(null)
const busy = computed(() => schemaLoading.value || generatingSql.value || testing.value || saving.value)
const { testQuery } = useSavedSqlQueryTest()
const { saveQuery } = useSavedSqlQuerySave()
const { updateQuery } = useSavedSqlQueryUpdate()
const { getQuery } = useSavedSqlQuery(requestFetch)
const { data: existingQuery, refresh: reloadQuery } = await useAsyncData(
  `sql-workspace:query:${queryId.value || 'new'}`,
  () => queryId.value ? getQuery(queryId.value) : Promise.resolve(null)
)
const queryLoadFailed = computed(() => !!queryId.value && !existingQuery.value?.query)
const hydrateQuery = () => {
  const query = existingQuery.value?.query
  if (!query) return
  connectionId.value = query.connectionId
  queryName.value = query.queryName
  sql.value = query.sql
}
hydrateQuery()
watch(existingQuery, hydrateQuery)
const ai = useAIModels()
const { selectedModel, selected, ready, generate, load, stop } = ai
const { selectedCached, loading, supported, progress, status } = ai.local
const modelError = computed(() => ai.error.value || ai.local.error.value)
const modelGroups = computed(() => ['openai', 'lmstudio', 'webllm'].map(type => ({
  label: type === 'openai' ? 'OpenAI' : type === 'lmstudio' ? 'LM Studio' : 'Browser Models',
  models: ai.settings.value.models.filter(model => model.providerType === type)
})).filter(group => group.models.length))
const lmSessionKey = ref('')
watch(lmSessionKey, value => { if (selected.value?.providerConnectionId) ai.sessionKeys.set(selected.value.providerConnectionId, value) })
watch(selectedModel, () => { revision++; lmSessionKey.value = '' })

const testedSignature = ref('')
const signature = computed(() => JSON.stringify([connectionId.value, sql.value]))
const canSave = computed(() => !queryLoadFailed.value && testedSignature.value === signature.value && !!queryName.value.trim() && !!sql.value.trim() && !!connectionId.value)
let revision = 0
let schemaRequest = 0
watch(connectionId, () => { revision++; schemaRequest++; databaseStepOpen.value = true; schemaLoading.value = false; schemaDatabaseType.value = undefined; schema.value = ''; schemaColumns.value = 0; schemaLoaded.value = false; schemaError.value = ''; result.value = null; error.value = ''; saved.value = false }, { flush: 'sync' })
watch(sql, () => { revision++; result.value = null; saved.value = false }, { flush: 'sync' })
watch(queryName, () => { saved.value = false })
onBeforeUnmount(() => { revision++; schemaRequest++ })

const loadSchema = async () => {
  if (!connectionId.value) throw new Error('Select a database connection first.')
  const current = ++schemaRequest
  const selectedConnection = connectionId.value
  schemaLoading.value = true
  schema.value = ''
  schemaColumns.value = 0
  schemaLoaded.value = false
  schemaError.value = ''
  try {
    const response = await $fetch<{ ok: boolean, schema: string, databaseType: AISqlDialect, columnCount: number, message?: string }>(`/api/connections/${encodeURIComponent(selectedConnection)}/schema`, { retry: 0 })
    if (current !== schemaRequest) throw new Error('The selected connection changed. Try again.')
    if (!response.ok) throw new Error(response.message || 'Could not read the schema.')
    requestSessionExpired.value = false
    if (!response.databaseType) throw new Error('Database dialect is missing. Reload the page and read the schema again.')
    schemaDatabaseType.value = response.databaseType
    schema.value = response.schema
    schemaColumns.value = response.columnCount
    schemaLoaded.value = true
    databaseStepOpen.value = false
    return response.schema
  } catch (cause) {
    if (current === schemaRequest) {
      databaseStepOpen.value = true
      schemaError.value = messageFor(cause)
      errorTitle.value = 'Could not read the database schema'
    }
    throw cause
  } finally { if (current === schemaRequest) schemaLoading.value = false }
}
const messageFor = (cause: unknown): string => {
  const failure = cause as { data?: { message?: string, statusMessage?: string }, statusCode?: number, status?: number, message?: string }
  const statusCode = getRequestStatus(cause)
  if (statusCode === 401) { requestSessionExpired.value = true; return SESSION_EXPIRED_MESSAGE }
  if (statusCode === 503 || failure?.message?.includes('503')) return 'The database server could not be reached. Check that it is running and that the saved hostname and port are reachable from the app server.'
  if (statusCode === 429) return 'Too many requests. Please wait a minute and try again.'
  const message = failure?.data?.message || failure?.data?.statusMessage || failure?.message
  return message && !message.startsWith('[GET]') ? message : 'Could not read the database schema. Check the connection settings and try again.'
}

const inspectSchema = async () => {
  const selectedConnection = connectionId.value
  if (!selectedConnection || queryLoadFailed.value) return
  error.value = ''
  try { await loadSchema() } catch (cause) {
    if (selectedConnection === connectionId.value && schemaError.value) error.value = messageFor(cause)
  }
}
onMounted(() => { void inspectSchema() })
watch(connectionId, () => { if (import.meta.client) void inspectSchema() })
watch(connectionOptions, options => {
  if (!connectionId.value && !queryId.value) connectionId.value = options[0]?.value ?? ''
})
const generateSql = async () => {
  if (busy.value || !ready.value) return
  const current = revision
  generatingSql.value = true
  errorTitle.value = 'Could not generate SQL'
  error.value = ''
  try {
    const freshSchema = await loadSchema()
    if (current !== revision) return
    if (!schemaDatabaseType.value) throw new Error('Read the database schema first.')
    const generated = await generate(freshSchema, question.value, schemaDatabaseType.value)
    if (current === revision) sql.value = generated
  } catch (cause) { if (current === revision) error.value = messageFor(cause) }
  finally { generatingSql.value = false }
}
const cancelGeneration = () => { revision++; stop() }
const runTest = async () => {
  if (busy.value || queryLoadFailed.value) return
  testedSignature.value = ''
  const testingSignature = signature.value
  testing.value = true
  errorTitle.value = 'SQL test failed'
  result.value = null
  error.value = ''
  const current = revision
  try {
    const response = await testQuery({ connectionId: connectionId.value, sql: sql.value })
    if (current !== revision) return
    result.value = response
    if (response.ok) testedSignature.value = testingSignature
    if (!response.ok) error.value = `${t(response.messageKey || response.message)}${response.details ? ` ${response.details}` : ''}`
  } catch (cause) { if (current === revision) error.value = messageFor(cause) }
  finally { testing.value = false }
}
const save = async () => {
  if (busy.value || !canSave.value || saved.value) return
  saving.value = true
  errorTitle.value = 'Could not save query'
  error.value = ''
  const current = revision
  try {
    const input = { connectionId: connectionId.value, queryName: queryName.value, sql: sql.value }
    const response = await (queryId.value ? updateQuery(queryId.value, input) : saveQuery(input))
    if (current !== revision) return
    if (response.ok) {
      saved.value = true
      if (!queryId.value && response.query) {
        queryId.value = response.query.id
        await navigateTo({ path: '/sql-workspace', query: { queryId: response.query.id } }, { replace: true })
      }
    }
    else error.value = t(response.messageKey || response.message)
  } catch (cause) { if (current === revision) error.value = messageFor(cause) }
  finally { saving.value = false }
}
</script>

<template>
  <UPage class="px-4 sm:px-6 lg:px-8">
    <UPageHeader
      :headline="$t('queries.index.headline')"
      :title="queryId ? $t('workspace.editTitle') : $t('interface.sqlWorkspace')"
      :description="$t('interface.askAQuestionRefineTheSQLAndTestItAgainst')"
      class="pb-6"
    >
      <template #links>
        <div class="flex items-center gap-2 sm:gap-3">
          <UButton to="/queries" color="neutral" variant="soft" icon="i-lucide-arrow-left" :label="$t('navigation.queries')" />


        </div>
      </template>
    </UPageHeader>
    <UPageBody class="space-y-6 sm:space-y-8">
      <div v-if="error || modelError" role="alert" aria-live="assertive" class="sticky top-2 z-30 mb-6">
        <AppAlert kind="error" :title="localizeAppMessage($t, error ? errorTitle : $t('interface.localModelUnavailable'))">
          <p>{{ localizeAppMessage($t, error || modelError) }}</p>
          <UButton v-if="ai.sessionExpired.value || requestSessionExpired" to="/login?callbackRedirectUrl=/sql-workspace" target="_blank" rel="noopener" class="mt-3" :label="$t('interface.signInAgainNewTab')" />
          <UButton v-if="schemaError && connectionId && !requestSessionExpired" :to="`/connections/${connectionId}`" class="mt-3" color="neutral" variant="outline" :label="$t('interface.checkConnectionSettings')" />
        </AppAlert>
      </div>
      <AppAlert v-if="queryLoadFailed" kind="error" :title="$t('workspace.loadFailed')">
        <p>{{ localizeAppMessage($t, existingQuery?.messageKey || existingQuery?.message || $t('workspace.loadFailed')) }}</p>
        <UButton class="mt-3" :label="$t('interface.retry')" @click="reloadQuery()" />
      </AppAlert>
      <AppAlert v-else-if="!connections?.ok" kind="error" :title="$t('interface.couldNotLoadConnections')">
        <p>{{ t(connections?.messageKey || $t('interface.connectionsListErrorsUnexpected')) }}</p>
        <UButton class="mt-3" :label="$t('interface.retry')" color="neutral" variant="outline" @click="reloadConnections()" />
      </AppAlert>
      <UPageCard v-else-if="!connectionOptions.length" :title="$t('interface.connectADatabaseFirst')" :description="$t('interface.addAPostgreSQLConnectionToGenerateAndTestQueries')">
        <UButton :to="`/connections/new?from=sql-workspace`" :label="$t('interface.addConnection')" icon="i-lucide-database" />
      </UPageCard>
      <div v-else class="grid min-w-0 gap-6 lg:grid-cols-2">
        <div class="min-w-0 space-y-6">
          <WorkspaceStep v-model:open="databaseStepOpen" :title="$t('interface.chooseDatabaseStep')" icon="i-lucide-database">
            <template #summary>
              <span v-if="schemaLoading" role="status" class="mt-2 block text-sm font-normal text-muted">{{ $t('workspace.readingSchema') }}</span>
              <span v-else-if="schemaLoaded" role="status" class="mt-2 block text-sm font-normal text-success">{{ selectedConnectionName }} · {{ $t('interface.columnsAvailable', { value1: schemaColumns }) }}</span>
            </template>
            <UFormField :label="$t('interface.databaseConnection')" name="connection">
              <USelect v-model="connectionId" :items="connectionOptions" :disabled="busy" class="w-full" />
            </UFormField>
            <UButton v-if="connectionId" :to="`/connections/${connectionId}`" color="neutral" variant="link" icon="i-lucide-settings-2" :label="$t('interface.editOrTestThisConnection')" />
            <AppAlert v-if="schemaError" kind="error" :title="$t('interface.schemaUnavailable')">{{ localizeAppMessage($t, schemaError) }}</AppAlert>
            <div class="flex flex-wrap items-center gap-3 sm:gap-4">
              <UButton :label="$t('interface.readSchema')" color="neutral" variant="outline" :loading="schemaLoading" :disabled="busy || !connectionId" @click="inspectSchema" />
              <span v-if="schemaColumns" class="text-sm text-muted">{{ $t('interface.columnsAvailable', { value1: schemaColumns }) }}</span>
            </div>
            <details v-if="schema" class="text-sm">
              <summary class="cursor-pointer font-medium">{{ $t('interface.databaseSchema') }}</summary>
              <pre class="mt-3 max-h-64 overflow-auto rounded-lg bg-elevated p-4 sm:p-6 text-xs">{{ schema }}</pre>
            </details>
            <p v-else-if="schemaLoaded && schemaColumns === 0" class="text-sm text-muted">{{ $t('interface.noAccessibleTablesFound') }}</p>
          </WorkspaceStep>

          <WorkspaceStep :title="$t('interface.askQuestionStep')" icon="i-lucide-sparkles" :description="$t('interface.optionalGenerateSQLUsingYourConfiguredAIModel')">
            <UButton to="/settings/ai-models" :label="$t('interface.settingsAIModels')" color="neutral" variant="link" />
            <UFormField :label="$t('interface.aiModel')" name="model">
              <select v-model="selectedModel" :disabled="busy || loading" class="w-full rounded-lg border border-default bg-default p-3">
                <option value="" disabled>{{ $t('interface.selectAConfiguredModel') }}</option>
                <optgroup v-for="group in modelGroups" :key="group.label" :label="localizeAppMessage($t, group.label)"><option v-for="model in group.models" :key="model.id" :value="model.id">{{ model.displayName }}{{ model.isDefault ? $t('interface.default') : '' }}</option></optgroup>
              </select>
            </UFormField>
            <UFormField v-if="selected?.providerType === 'lmstudio'" :label="$t('interface.lmStudioAPIKeyOptionalThisPageSessionOnly')"><UInput v-model="lmSessionKey" type="password" autocomplete="off" /></UFormField>
            <AppAlert v-if="selected && selected.providerType !== 'webllm'" kind="warning" :title="localizeAppMessage($t, $t('interface.providerDataNotice'))">{{ $t('interface.yourQuestionAndSelectedDatabaseSchemaWillBeSentTo2', { value1: ai.connectionFor(selected)?.name, value2: ai.connectionFor(selected)?.baseUrl }) }}</AppAlert>
            <AppAlert v-if="selected?.providerType === 'webllm' && !supported" kind="warning" :title="$t('interface.browserModelUnavailable')">{{ $t('interface.useHTTPSOrLocalhostWithAWebGPUCompatibleBrowserOr') }}</AppAlert>
            <template v-if="selected">
              <div class="flex flex-wrap gap-2 sm:gap-3">
                <UButton v-if="selected.providerType === 'webllm' && !ready" :label="selectedCached ? $t('interface.loadCachedModel') : $t('interface.downloadAndLoadModel')" color="neutral" variant="outline" icon="i-lucide-download" :loading="loading" :disabled="loading || busy" @click="load" />
                <UButton v-if="loading" :label="$t('interface.cancelDownload')" color="neutral" variant="ghost" @click="stop" />
                <UBadge v-if="ready" :label="selected.providerType === 'webllm' ? $t('interface.modelReadyRunsLocally') : $t('interface.providerConfiguredVerifiedWhenGenerating')" color="success" variant="subtle" />
              </div>
              <div v-if="loading" class="space-y-2" :aria-busy="loading">
                <div class="flex justify-between gap-3 text-sm">
                  <span>{{ $t('interface.downloadingAndInitializingModel') }}</span>
                  <span class="tabular-nums">{{ progress }}%</span>
                </div>
                <UProgress :model-value="progress" :max="100" :aria-label="$t('interface.localModelDownloadAndInitializationProgress')" />
                <p class="text-sm text-muted">{{ $t('interface.theFirstDownloadCanTakeSeveralMinutesInitializationContinuesAfter') }}</p>
              </div>
              <p v-if="status" role="status" class="break-words text-sm text-muted">{{ localizeAppMessage($t, status) }}</p>
              <UFormField v-if="ready" :label="$t('interface.whatWouldYouLikeToKnow')" name="question" :description="$t('interface.theSelectedDatabaseSchemaIsFetchedBeforeEveryGeneration')">
                <UTextarea v-model="question" :placeholder="$t('interface.showMeMonthlySales')" :rows="3" :maxlength="2000" :disabled="busy" class="w-full" />
              </UFormField>
              <UButton v-if="ready" :label="$t('interface.generateSQL')" icon="i-lucide-sparkles" :loading="generatingSql" :disabled="busy || !question.trim() || !connectionId" @click="generateSql" />
              <UButton v-if="generatingSql" :label="$t('interface.cancelGeneration')" color="neutral" variant="ghost" @click="cancelGeneration" />
            </template>
            <AppAlert v-if="modelError" kind="error" :title="$t('interface.modelCouldNotBeLoaded')">{{ localizeAppMessage($t, modelError) }}</AppAlert>
          </WorkspaceStep>

          <WorkspaceStep :title="$t('interface.editAndTestSqlStep')" icon="i-lucide-code" :description="$t('interface.generatedSQLAppearsHereEditItFreelyOrWriteYour')">
            <UFormField :label="$t('interface.sqlQuery')" name="sql" :description="$t('interface.testsRunAsReadOnlyQueriesWithARowLimit')">
              <UTextarea v-model="sql" :rows="12" :maxlength="20000" :disabled="busy" spellcheck="false" :placeholder="$t('interface.select')" class="w-full" :ui="{ base: 'font-mono text-sm' }" />
            </UFormField>
            <AppAlert v-if="error" kind="error" :title="$t('interface.couldNotCompleteTheRequest')">{{ localizeAppMessage($t, error) }}</AppAlert>
            <UButton :label="$t('interface.testSQL')" icon="i-lucide-play" :loading="testing" :disabled="busy || !connectionId || !sql.trim()" @click="runTest" />
            <div class="border-t border-default pt-6 sm:pt-8">
              <UFormField :label="$t('interface.queryName')" name="queryName" :description="$t('interface.saveThisQueryToMakeItAvailableWhenAddingA')">
                <UInput v-model="queryName" :placeholder="$t('interface.monthlySales')" :disabled="busy" class="w-full" />
              </UFormField>
              <UButton class="mt-4 sm:mt-6" :label="$t('interface.saveQuery')" color="neutral" variant="outline" icon="i-lucide-save" :loading="saving" :disabled="busy || saved || !canSave" @click="save" />
              <p v-if="!canSave && !saved" class="mt-3 text-sm text-muted">{{ $t('workspace.testBeforeSaving') }}</p>
              <p v-if="saved" role="status" class="mt-4 sm:mt-6 text-sm text-success">{{ $t('interface.querySavedItIsNowAvailableInTheDashboardWidget') }}</p>
            </div>
          </WorkspaceStep>
        </div>
        <UPageCard class="min-w-0 self-start lg:sticky lg:top-28 space-y-4 sm:space-y-6" :title="$t('interface.queryResults')" icon="i-lucide-table-2" :description="$t('interface.resultsFromYourLatestSQLTestAppearHere')">
          <div v-if="testing" role="status" class="py-16 text-center text-muted">{{ $t('interface.runningYourQuery') }}</div>
          <template v-else-if="result?.ok">
            <p role="status" class="text-sm text-muted">{{ $t('interface.rowsReturnedPreviewLimitedToRows', { value1: result.rows?.length ?? 0, value2: result.rowLimit }) }}</p>
            <div v-if="result.rows?.length" class="max-h-[65vh] overflow-auto rounded-lg border border-default">
              <table class="w-full text-left text-sm">
                <caption class="sr-only">{{ $t('interface.sqlTestResults') }}</caption>
                <thead class="sticky top-0 bg-elevated">
                  <tr><th v-for="column in result.columns" :key="column" scope="col" class="whitespace-nowrap px-4 sm:px-6 py-3 font-semibold">{{ column }}</th></tr>
                </thead>
                <tbody class="divide-y divide-default">
                  <tr v-for="(row, index) in result.rows" :key="index">
                    <td v-for="column in result.columns" :key="column" class="max-w-96 whitespace-pre-wrap break-words px-4 sm:px-6 py-3 align-top tabular-nums">{{ row[column] === null ? 'NULL' : String(row[column]) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p v-else class="py-12 text-center text-muted">{{ $t('interface.theQuerySucceededButReturnedNoRows') }}</p>
          </template>
          <p v-else-if="result && !result.ok" role="status" class="py-12 text-center text-muted">{{ $t('interface.theTestFailedReviewTheErrorBesideTheSQLEditor') }}</p>
          <div v-else class="space-y-4 sm:space-y-6 py-16 text-center text-muted">
            <UIcon name="i-lucide-table-2" class="size-10" />
            <p>{{ $t('interface.writeOrGenerateSQLThenSelectTestSQL') }}</p>
          </div>
        </UPageCard>
      </div>
    </UPageBody>
  </UPage>
</template>

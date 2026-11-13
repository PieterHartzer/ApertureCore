<script setup lang="ts">
import type { AISqlDialect } from '../../shared/types/ai'
import WorkspacePanel from '~/components/ui/WorkspacePanel.vue'
import PanelResizer from '~/components/ui/PanelResizer.vue'
import SqlEditor from '~/components/ui/SqlEditor.vue'
import { clampPanelRatio, useWorkspaceLayout } from '~/composables/useWorkspaceLayout'
import AppAlert from '~/components/ui/AppAlert.vue'
import ExtensionSlot from '~/components/ui/ExtensionSlot.vue'
import { useSavedDatabaseConnections } from '~/composables/database/useSavedDatabaseConnections'
import { useSavedSqlQueryTest } from '~/composables/database/useSavedSqlQueryTest'
import { useSavedSqlQuery } from '~/composables/database/useSavedSqlQuery'
import { useSavedSqlQueries } from '~/composables/database/useSavedSqlQueries'
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
const requestedConnection = connectionOptions.value.find(option => option.value === route.query.connectionId)?.value
const connectionId = ref(requestedConnection ?? connectionOptions.value[0]?.value ?? '')
const question = ref('')
const sql = ref('')
const queryName = ref('')
const { layout, canCollapse, togglePanel, rightCollapsed, stackRight } = useWorkspaceLayout()
const selectedDatabaseType = computed(() => (connections.value?.connections ?? []).find(connection => connection.id === connectionId.value)?.databaseType ?? 'postgres')
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
const { listQueries } = useSavedSqlQueries(requestFetch)
const { data: savedQueries } = await useAsyncData('sql-workspace:queries', listQueries)
const NEW_QUERY = 'new'
const queryOptions = computed(() => [
  { label: t('workspace.newQuery'), value: NEW_QUERY, icon: 'i-lucide-plus' },
  { type: 'separator' as const },
  ...(savedQueries.value?.queries ?? [])
    .filter(query => query.connectionId === connectionId.value || query.id === queryId.value)
    .map(query => ({ label: query.queryName, value: query.id }))
])
const pendingQuery = ref<string | null>(null)
const openQuery = (target: string) => navigateTo({
  path: '/sql-workspace',
  query: target === NEW_QUERY ? { connectionId: connectionId.value } : { queryId: target }
})
const hasUnsavedSql = computed(() => !saved.value && sql.value !== (existingQuery.value?.query?.sql ?? ''))
const onQueryChange = (target?: string) => {
  if (!target || target === (queryId.value || NEW_QUERY)) return
  if (hasUnsavedSql.value) pendingQuery.value = target
  else void openQuery(target)
}
const discardAndOpenQuery = () => {
  const target = pendingQuery.value
  pendingQuery.value = null
  if (target) void openQuery(target)
}
// Only the query this page opened with can fail to load. Right after a first save
// queryId holds the new id for a moment before the page switches to it.
const openedQueryId = queryId.value
const queryLoadFailed = computed(() => !!openedQueryId && !existingQuery.value?.query)
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
const BROWSER_PROVIDER = 'browser'
const providerOptions = computed(() => [
  { label: t('ai.browser.name'), value: BROWSER_PROVIDER },
  ...ai.settings.value.connections.map(connection => ({ label: connection.providerType === 'lmstudio' ? t('ai.local.name') : connection.name, value: connection.id }))
])
const modelsFor = (provider: string) => ai.settings.value.models.filter(model => (model.providerConnectionId ?? BROWSER_PROVIDER) === provider)
// Held separately so a provider with no models yet can stay selected.
const chosenProvider = ref<string | null>(null)
const firstModelId = (provider: string) => {
  const models = modelsFor(provider)
  return (models.find(model => model.isDefault) ?? models[0])?.id ?? ''
}
const discoveringModels = ref(false)
const modelListFailed = ref(false)
const isLocalProvider = (provider: string) => ai.settings.value.connections.some(connection => connection.id === provider && connection.providerType === 'lmstudio')
// A local server's models change whenever someone loads a different one, so
// its list is read live rather than from what was saved at setup.
const refreshLocalModels = async (provider: string) => {
  if (!isLocalProvider(provider)) return
  discoveringModels.value = true
  modelListFailed.value = false
  try {
    const modelIds = await ai.availableModels(provider)
    if (!modelIds.length) return
    const stillChosen = chosenProvider.value === provider
    await ai.update({ action: 'models', id: provider, providerType: 'lmstudio', modelIds: modelIds.slice(0, 100), replace: true })
    if (stillChosen) {
      chosenProvider.value = provider
      if (!modelsFor(provider).some(model => model.id === selectedModel.value)) selectedModel.value = firstModelId(provider)
    }
  } catch {
    modelListFailed.value = true
  } finally {
    discoveringModels.value = false
  }
}
const selectedProvider = computed({
  get: () => chosenProvider.value ?? selected.value?.providerConnectionId ?? BROWSER_PROVIDER,
  set: (provider: string) => {
    chosenProvider.value = provider
    modelListFailed.value = false
    selectedModel.value = firstModelId(provider)
    void refreshLocalModels(provider)
  }
})
watch(selected, (model) => { if (model) chosenProvider.value = model.providerConnectionId ?? BROWSER_PROVIDER })
const modelOptions = computed(() => modelsFor(selectedProvider.value).map(model => ({
  value: model.id,
  label: model.providerType === 'webllm' ? ai.local.models.value.find(option => option.value === model.modelId)?.label ?? model.displayName : model.displayName
})))
const MODEL_STORAGE_KEY = 'autodash.sqlEditor.model'
let rememberedModel: string | null = null
let modelRestored = false
onMounted(() => { try { rememberedModel = localStorage.getItem(MODEL_STORAGE_KEY) } catch { rememberedModel = null } })
watch(() => ai.settings.value.models, (models) => {
  if (modelRestored || !models.length) return
  modelRestored = true
  if (rememberedModel && models.some(model => model.id === rememberedModel)) selectedModel.value = rememberedModel
  void refreshLocalModels(selectedProvider.value)
})
watch(selectedModel, (value) => { if (modelRestored && value) try { localStorage.setItem(MODEL_STORAGE_KEY, value) } catch { /* Remembering the model is optional. */ } })
const { localeProperties } = useI18n()
const promptLanguage = computed(() => {
  const tag = localeProperties.value.language ?? localeProperties.value.code
  try { return new Intl.DisplayNames(['en'], { type: 'language' }).of(tag) ?? undefined } catch { return undefined }
})
const usesBrowserModel = computed(() => selected.value?.providerType === 'webllm')
const canGenerate = computed(() => !busy.value && !loading.value && !!question.value.trim() && !!connectionId.value && schemaLoaded.value && !!selected.value && (!usesBrowserModel.value || supported.value))
const lmSessionKey = ref('')
watch(lmSessionKey, value => { if (selected.value?.providerConnectionId) ai.sessionKeys.set(selected.value.providerConnectionId, value) })
watch(selectedModel, () => { revision++; lmSessionKey.value = '' })

const testedSignature = ref('')
const signature = computed(() => JSON.stringify([connectionId.value, sql.value]))
const canSave = computed(() => !queryLoadFailed.value && testedSignature.value === signature.value && !!queryName.value.trim() && !!sql.value.trim() && !!connectionId.value)
let revision = 0
let schemaRequest = 0
watch(connectionId, () => { revision++; schemaRequest++; schemaLoading.value = false; schemaDatabaseType.value = undefined; schema.value = ''; schemaColumns.value = 0; schemaLoaded.value = false; schemaError.value = ''; result.value = null; error.value = ''; saved.value = false }, { flush: 'sync' })
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
    return response.schema
  } catch (cause) {
    if (current === schemaRequest) {
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
  if (!canGenerate.value) return
  if (usesBrowserModel.value && !ready.value) {
    await load()
    if (!ready.value) return
  }
  const current = revision
  let generated = false
  generatingSql.value = true
  errorTitle.value = 'Could not generate SQL'
  error.value = ''
  try {
    // Re-read schema refreshes this, so rewording a question stays quick.
    const freshSchema = schemaLoaded.value ? schema.value : await loadSchema()
    if (current !== revision) return
    if (!schemaDatabaseType.value) throw new Error('Read the database schema first.')
    const generatedSql = await generate(freshSchema, question.value, schemaDatabaseType.value, promptLanguage.value)
    if (current === revision) { sql.value = generatedSql; generated = true }
  } catch (cause) { if (current === revision) error.value = messageFor(cause) }
  finally { generatingSql.value = false }
  // Running straight away lets people judge the answer and reword the question.
  if (generated) await runTest()
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
// Editing a saved query: "Save changes" updates it, "Save as new query" keeps
// it and creates another one, so changing the name and SQL never overwrites by surprise.
const save = async (asNew = false) => {
  if (busy.value || !canSave.value || (saved.value && !asNew)) return
  saving.value = true
  errorTitle.value = 'Could not save query'
  error.value = ''
  const current = revision
  try {
    const input = { connectionId: connectionId.value, queryName: queryName.value, sql: sql.value }
    const creating = asNew || !queryId.value
    const response = await (creating ? saveQuery(input) : updateQuery(queryId.value, input))
    if (current !== revision) return
    if (response.ok) {
      saved.value = true
      if (creating && response.query) {
        const firstSave = !queryId.value
        queryId.value = response.query.id
        await navigateTo({ path: '/sql-workspace', query: { queryId: response.query.id } }, { replace: firstSave })
      }
    }
    else error.value = t(response.messageKey || response.message)
  } catch (cause) { if (current === revision) error.value = messageFor(cause) }
  finally { saving.value = false }
}
</script>

<template>
  <div class="flex flex-col gap-3 lg:h-[calc(100dvh-3rem)] lg:min-h-[30rem]">
    <div class="flex flex-none flex-wrap items-center gap-2">
      <h1 class="mr-2 text-xl font-semibold tracking-tight text-highlighted">{{ $t('workspace.editTitle') }}</h1>
      <label v-if="connectionOptions.length" class="flex items-center gap-2 text-xs font-medium text-muted">
        {{ $t('interface.databaseConnection') }}
        <USelect v-model="connectionId" :items="connectionOptions" :disabled="busy" icon="i-lucide-database" class="w-44" />
      </label>
      <label v-if="connectionOptions.length" class="flex items-center gap-2 text-xs font-medium text-muted">
        {{ $t('workspace.querySelect') }}
        <USelect :model-value="queryId || NEW_QUERY" :items="queryOptions" :disabled="busy" class="w-44" @update:model-value="onQueryChange" />
      </label>
      <span v-if="schemaLoading" role="status" class="text-sm text-muted">{{ $t('workspace.readingSchema') }}</span>
      <UPopover v-else-if="schemaLoaded">
        <UButton color="neutral" variant="ghost" size="sm" :label="$t('interface.columnsAvailable', { value1: schemaColumns })" />
        <template #content><pre class="max-h-80 max-w-[32rem] overflow-auto p-3 text-xs">{{ schema || $t('interface.noAccessibleTablesFound') }}</pre></template>
      </UPopover>
      <UButton v-if="connectionId" color="neutral" variant="ghost" size="sm" square icon="i-lucide-refresh-cw" :loading="schemaLoading" :disabled="busy" :aria-label="$t('workspace.rereadSchema')" :title="$t('workspace.rereadSchema')" @click="inspectSchema" />
      <div class="ml-auto flex items-center gap-2">
        <UButton class="hidden lg:inline-flex" color="neutral" variant="outline" size="sm" square :icon="layout.resultsBelow ? 'i-lucide-columns-3' : 'i-lucide-rows-2'" :aria-label="layout.resultsBelow ? $t('workspace.resultsBeside') : $t('workspace.resultsBelow')" :title="layout.resultsBelow ? $t('workspace.resultsBeside') : $t('workspace.resultsBelow')" @click="layout.resultsBelow = !layout.resultsBelow" />
        <UButton to="/queries" color="neutral" variant="ghost" size="sm" icon="i-lucide-arrow-left" :label="$t('navigation.queries')" />
      </div>
    </div>

    <UModal :open="!!pendingQuery" :title="$t('workspace.discard.title')" :description="$t('workspace.discard.description')" @update:open="pendingQuery = null">
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton color="neutral" variant="ghost" :label="$t('workspace.discard.keep')" @click="pendingQuery = null" />
          <UButton color="error" :label="$t('workspace.discard.confirm')" @click="discardAndOpenQuery" />
        </div>
      </template>
    </UModal>

    <div v-if="error" role="alert" aria-live="assertive" class="flex-none">
      <AppAlert kind="error" :title="localizeAppMessage($t, errorTitle)">
        <p>{{ localizeAppMessage($t, error) }}</p>
        <UButton v-if="ai.sessionExpired.value || requestSessionExpired" to="/login?callbackRedirectUrl=/sql-workspace" target="_blank" rel="noopener" class="mt-2" :label="$t('interface.signInAgainNewTab')" />
        <UButton v-if="schemaError && connectionId && !requestSessionExpired" :to="`/connections/${connectionId}`" class="mt-2" color="neutral" variant="outline" size="sm" :label="$t('interface.checkConnectionSettings')" />
      </AppAlert>
    </div>
    <AppAlert v-if="queryLoadFailed" kind="error" :title="$t('workspace.loadFailed')">
      <p>{{ localizeAppMessage($t, existingQuery?.messageKey || existingQuery?.message || $t('workspace.loadFailed')) }}</p>
      <UButton class="mt-2" :label="$t('interface.retry')" @click="reloadQuery()" />
    </AppAlert>
    <AppAlert v-else-if="!connections?.ok" kind="error" :title="$t('interface.couldNotLoadConnections')">
      <p>{{ t(connections?.messageKey || $t('interface.connectionsListErrorsUnexpected')) }}</p>
      <UButton class="mt-2" :label="$t('interface.retry')" color="neutral" variant="outline" @click="reloadConnections()" />
    </AppAlert>
    <UPageCard v-else-if="!connectionOptions.length" :title="$t('interface.connectADatabaseFirst')" :description="$t('workspace.connectDatabaseDescription')">
      <UButton :to="`/connections/new?from=sql-workspace`" :label="$t('interface.addConnection')" icon="i-lucide-database" />
    </UPageCard>

    <div v-else class="sql-panels overflow-hidden rounded-[10px] border border-default bg-[var(--surface)] backdrop-blur-md">
      <div class="sql-slot" :data-fixed="layout.collapsed.prompt ? 'true' : 'false'" :style="{ '--grow': rightCollapsed ? 1 : layout.promptRatio }">
        <WorkspacePanel :title="$t('workspace.panels.prompt')" icon="i-lucide-message-square-text" :collapsed="layout.collapsed.prompt" :can-collapse="canCollapse('prompt')" @toggle="togglePanel('prompt')">
          <div class="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
            <div class="grid grid-cols-2 gap-2">
              <UFormField :label="$t('workspace.ask.provider')" name="provider">
                <USelect v-model="selectedProvider" :items="providerOptions" :disabled="busy || loading" class="w-full" />
              </UFormField>
              <UFormField :label="$t('workspace.ask.model')" name="model">
                <template v-if="isLocalProvider(selectedProvider)" #hint>
                  <UButton color="neutral" variant="link" size="xs" square class="p-0" icon="i-lucide-refresh-cw" :loading="discoveringModels" :aria-label="$t('workspace.ask.refreshModels')" :title="$t('workspace.ask.refreshModels')" @click="refreshLocalModels(selectedProvider)" />
                </template>
                <USelect v-model="selectedModel" :items="modelOptions" :loading="discoveringModels" :disabled="busy || loading || !modelOptions.length" :placeholder="$t('workspace.ask.noModels')" class="w-full" />
              </UFormField>
            </div>
            <p v-if="modelListFailed" role="status" class="text-xs text-warning">{{ $t('workspace.ask.modelListFailed') }}</p>
            <NuxtLink to="/settings/ai-models" class="-mt-1 self-start text-xs text-muted hover:text-highlighted">{{ $t('workspace.ask.manage') }}</NuxtLink>
            <p v-if="usesBrowserModel && !supported" class="text-xs text-warning">{{ $t('interface.useHTTPSOrLocalhostWithAWebGPUCompatibleBrowserOr') }}</p>
            <p v-else-if="selected && !usesBrowserModel" class="text-xs text-muted">{{ $t('interface.yourQuestionAndSelectedDatabaseSchemaWillBeSentTo2', { value1: ai.connectionFor(selected)?.name, value2: ai.connectionFor(selected)?.baseUrl }) }}</p>
            <UFormField v-if="selected?.providerType === 'lmstudio'" :label="$t('workspace.ask.serverKey')" name="serverKey">
              <UInput v-model="lmSessionKey" type="password" autocomplete="off" size="sm" class="w-full" />
            </UFormField>
            <label class="-mb-2 text-sm font-medium text-default" for="sql-question">{{ $t('workspace.ask.question') }}</label>
            <textarea
              id="sql-question"
              v-model="question"
              class="min-h-32 w-full flex-1 resize-none rounded-md border border-default bg-default p-2.5 text-sm text-highlighted outline-none placeholder:text-dimmed focus:border-primary"
              :placeholder="$t('interface.showMeMonthlySales')"
              :aria-label="$t('workspace.ask.question')"
              :maxlength="2000"
              :disabled="busy"
              @keydown.meta.enter.prevent="generateSql"
              @keydown.ctrl.enter.prevent="generateSql"
            />
            <div v-if="loading" class="space-y-1" :aria-busy="loading">
              <UProgress :model-value="progress" :max="100" size="sm" :aria-label="$t('interface.localModelDownloadAndInitializationProgress')" />
              <p class="flex justify-between gap-2 text-xs text-muted"><span>{{ $t('workspace.ask.downloadNote') }}</span><span class="tabular-nums">{{ progress }}%</span></p>
            </div>
            <p v-else-if="status && usesBrowserModel" role="status" class="break-words text-xs text-muted">{{ localizeAppMessage($t, status) }}</p>
            <AppAlert v-if="modelError" kind="error" :title="$t('interface.modelCouldNotBeLoaded')">{{ localizeAppMessage($t, modelError) }}</AppAlert>
            <div class="flex flex-wrap gap-2">
              <UButton class="flex-1 justify-center" icon="i-lucide-sparkles" :label="usesBrowserModel && !ready && !selectedCached ? $t('workspace.ask.downloadAndGenerate') : $t('interface.generateSQL')" :loading="generatingSql || loading" :disabled="!canGenerate" @click="generateSql" />
              <UButton v-if="generatingSql" color="neutral" variant="ghost" :label="$t('interface.cancelGeneration')" @click="cancelGeneration" />
              <UButton v-else-if="loading" color="neutral" variant="ghost" :label="$t('interface.cancelDownload')" @click="stop" />
            </div>
          </div>
        </WorkspacePanel>
      </div>

      <PanelResizer v-if="!layout.collapsed.prompt && !rightCollapsed" axis="x" :ratio="layout.promptRatio" :label="$t('workspace.resizePanels')" @update="layout.promptRatio = clampPanelRatio($event)" />
      <div v-else class="hidden w-px flex-none bg-[var(--ui-border)] lg:block" />

      <div class="sql-right" :data-fixed="rightCollapsed ? 'true' : 'false'" :data-below="stackRight ? 'true' : 'false'" :style="{ '--grow': layout.collapsed.prompt ? 1 : 1 - layout.promptRatio }">
        <div class="sql-slot" :data-fixed="layout.collapsed.sql ? 'true' : 'false'" :style="{ '--grow': layout.collapsed.results ? 1 : 1 - layout.resultsRatio }">
          <WorkspacePanel :title="$t('workspace.panels.sql')" icon="i-lucide-code" :collapsed="layout.collapsed.sql" :can-collapse="canCollapse('sql')" :stacked="stackRight" @toggle="togglePanel('sql')">
            <template #actions>
              <ExtensionSlot name="sqlWorkspace.actions" :slot-props="{ connectionId, sql, disabled: busy || !connectionId || !sql.trim() }" />
              <UButton size="xs" icon="i-lucide-play" :label="$t('interface.testSQL')" :loading="testing" :disabled="busy || !connectionId || !sql.trim()" @click="runTest" />
            </template>
            <SqlEditor
              v-model="sql"
              :database-type="selectedDatabaseType"
              :schema="schema"
              :label="$t('interface.sqlQuery')"
              :placeholder="$t('interface.select')"
              :disabled="busy"
              @run="runTest"
            />
            <div class="flex flex-none flex-wrap items-center gap-2 border-t border-default p-2">
              <label class="flex min-w-48 flex-1 items-center gap-2 text-xs font-medium text-muted">
                {{ $t('interface.queryName') }}
                <UInput v-model="queryName" size="sm" class="min-w-0 flex-1" :placeholder="$t('interface.monthlySales')" :disabled="busy" />
              </label>
              <UButton size="sm" icon="i-lucide-save" :label="queryId ? $t('interface.saveChanges') : $t('interface.saveQuery')" :loading="saving" :disabled="busy || saved || !canSave" :title="canSave ? undefined : $t('workspace.testBeforeSaving')" @click="save()" />
              <UButton v-if="queryId" size="sm" color="neutral" variant="outline" icon="i-lucide-copy-plus" :label="$t('interface.saveAsNew')" :disabled="busy || !canSave" :title="canSave ? $t('interface.saveAsNewHint') : $t('workspace.testBeforeSaving')" @click="save(true)" />
              <span v-if="saved" role="status" class="flex items-center gap-1 text-xs text-success"><UIcon name="i-lucide-check" class="size-3.5" aria-hidden="true" />{{ $t('workspace.saved') }}</span>
            </div>
          </WorkspacePanel>
        </div>

        <PanelResizer v-if="!layout.collapsed.sql && !layout.collapsed.results" :axis="stackRight ? 'y' : 'x'" :ratio="1 - layout.resultsRatio" :label="$t('workspace.resizePanels')" @update="layout.resultsRatio = clampPanelRatio(1 - $event)" />
        <div v-else class="hidden flex-none bg-[var(--ui-border)] lg:block" :class="stackRight ? 'h-px' : 'w-px'" />

        <div class="sql-slot" :data-fixed="layout.collapsed.results ? 'true' : 'false'" :style="{ '--grow': layout.collapsed.sql ? 1 : layout.resultsRatio }">
          <WorkspacePanel :title="$t('workspace.panels.results')" icon="i-lucide-table-2" :collapsed="layout.collapsed.results" :can-collapse="canCollapse('results')" :stacked="stackRight" @toggle="togglePanel('results')">
            <div class="min-h-40 flex-1 overflow-auto">
              <div v-if="testing" role="status" class="py-10 text-center text-sm text-muted">{{ $t('interface.runningYourQuery') }}</div>
              <template v-else-if="result?.ok">
                <table v-if="result.rows?.length" class="w-full text-left text-[13px]">
                  <caption class="sr-only">{{ $t('interface.sqlTestResults') }}</caption>
                  <thead class="sticky top-0 bg-elevated">
                    <tr><th v-for="column in result.columns" :key="column" scope="col" class="whitespace-nowrap px-3 py-2 text-xs font-medium text-muted">{{ column }}</th></tr>
                  </thead>
                  <tbody class="divide-y divide-default">
                    <tr v-for="(row, index) in result.rows" :key="index">
                      <td v-for="column in result.columns" :key="column" class="max-w-96 whitespace-pre-wrap break-words px-3 py-1.5 align-top tabular-nums">{{ row[column] === null ? 'NULL' : String(row[column]) }}</td>
                    </tr>
                  </tbody>
                </table>
                <p v-else class="py-10 text-center text-sm text-muted">{{ $t('interface.theQuerySucceededButReturnedNoRows') }}</p>
              </template>
              <p v-else-if="result && !result.ok" role="status" class="px-4 py-10 text-center text-sm text-muted">{{ $t('workspace.testFailed') }}</p>
              <div v-else class="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-sm text-muted">
                <UIcon name="i-lucide-table-2" class="size-7 text-dimmed" aria-hidden="true" />
                <p>{{ $t('interface.writeOrGenerateSQLThenSelectTestSQL') }}</p>
              </div>
            </div>
            <p v-if="result?.ok" role="status" class="flex-none border-t border-default px-3 py-1.5 text-xs text-muted">{{ $t('interface.rowsReturnedPreviewLimitedToRows', { value1: result.rows?.length ?? 0, value2: result.rowLimit }) }}</p>
          </WorkspacePanel>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sql-panels,
.sql-right {
  display: flex;
  flex-direction: column;
}

.sql-slot {
  min-width: 0;
  min-height: 0;
  border-bottom: 1px solid var(--ui-border);
}

.sql-right > .sql-slot:last-child {
  border-bottom: 0;
}

@media (min-width: 1024px) {
  .sql-panels {
    flex: 1 1 0;
    flex-direction: row;
    min-height: 0;
  }

  .sql-right {
    flex: var(--grow) 1 0;
    flex-direction: row;
    min-width: 0;
    min-height: 0;
  }

  .sql-right[data-below='true'] {
    flex-direction: column;
  }

  .sql-right[data-fixed='true'] {
    flex: none;
  }

  .sql-slot {
    flex: var(--grow) 1 0;
    border-bottom: 0;
  }

  .sql-slot[data-fixed='true'] {
    flex: none;
    width: 40px;
  }

  .sql-right[data-below='true'] > .sql-slot[data-fixed='true'] {
    width: auto;
    height: 40px;
  }
}
</style>

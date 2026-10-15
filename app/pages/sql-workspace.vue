<script setup lang="ts">
import AppAlert from '~/components/ui/AppAlert.vue'
import { useSavedDatabaseConnections } from '~/composables/database/useSavedDatabaseConnections'
import { useSavedSqlQueryTest } from '~/composables/database/useSavedSqlQueryTest'
import { useSavedSqlQuerySave } from '~/composables/database/useSavedSqlQuerySave'
import { useLocalSqlModel } from '~/composables/useLocalSqlModel'
import type { SavedSqlQueryTestResponse } from '~/types/saved-sql-queries'

const { t } = useI18n()
const requestFetch = import.meta.server ? useRequestFetch() : $fetch
const { listConnections } = useSavedDatabaseConnections(requestFetch)
const { data: connections, refresh: reloadConnections } = await useAsyncData('sql-workspace:connections', listConnections)
const connectionOptions = computed(() => (connections.value?.connections ?? []).map((connection) => ({ label: connection.connectionName, value: connection.id })))
const connectionId = ref(connectionOptions.value[0]?.value ?? '')
const question = ref('')
const sql = ref('')
const queryName = ref('')
const schema = ref('')
const schemaColumns = ref(0)
const schemaLoaded = ref(false)
const schemaLoading = ref(false)
const generatingSql = ref(false)
const testing = ref(false)
const saving = ref(false)
const error = ref('')
const errorTitle = ref('Could not complete the request')
const schemaError = ref('')
const saved = ref(false)
const result = ref<SavedSqlQueryTestResponse | null>(null)
const busy = computed(() => schemaLoading.value || generatingSql.value || testing.value || saving.value)
const { testQuery } = useSavedSqlQueryTest()
const { saveQuery } = useSavedSqlQuerySave()
const { models, selectedModel, selectedCached, ready, checking, loading, supported, progress, status, error: modelError, load, generate, stop } = useLocalSqlModel()
let revision = 0
watch(connectionId, () => { revision++; schema.value = ''; schemaColumns.value = 0; schemaLoaded.value = false; schemaError.value = ''; result.value = null; error.value = ''; saved.value = false })
watch(sql, () => { result.value = null; saved.value = false })
watch(queryName, () => { saved.value = false })
onBeforeUnmount(() => { revision++ })

const loadSchema = async () => {
  if (!connectionId.value) throw new Error('Select a database connection first.')
  const current = revision
  schemaLoading.value = true
  schema.value = ''
  schemaColumns.value = 0
  schemaLoaded.value = false
  schemaError.value = ''
  try {
    const response = await $fetch<{ ok: boolean, schema: string, columnCount: number, message?: string }>(`/api/connections/${encodeURIComponent(connectionId.value)}/schema`, { retry: 0 })
    if (current !== revision) throw new Error('The selected connection changed. Try again.')
    if (!response.ok) throw new Error(response.message || 'Could not read the schema.')
    schema.value = response.schema
    schemaColumns.value = response.columnCount
    schemaLoaded.value = true
    return response.schema
  } catch (cause) {
    if (current === revision) {
      schemaError.value = messageFor(cause)
      errorTitle.value = 'Could not read the database schema'
    }
    throw cause
  } finally { schemaLoading.value = false }
}
const messageFor = (cause: unknown): string => {
  const failure = cause as { data?: { message?: string, statusMessage?: string }, statusCode?: number, status?: number, message?: string }
  const statusCode = failure?.statusCode ?? failure?.status
  if (statusCode === 503 || failure?.message?.includes('503')) return 'The database server could not be reached. Check that it is running and that the saved hostname and port are reachable from the app server.'
  if (statusCode === 429) return 'Too many requests. Please wait a minute and try again.'
  const message = failure?.data?.message || failure?.data?.statusMessage || failure?.message
  return message && !message.startsWith('[GET]') ? message : 'Could not read the database schema. Check the connection settings and try again.'
}

const inspectSchema = async () => {
  error.value = ''
  try { await loadSchema() } catch (cause) { error.value = messageFor(cause) }
}
const generateSql = async () => {
  if (busy.value || !ready.value) return
  const current = revision
  generatingSql.value = true
  errorTitle.value = 'Could not generate SQL'
  error.value = ''
  try {
    const freshSchema = await loadSchema()
    const generated = await generate(freshSchema, question.value)
    if (current === revision) sql.value = generated
  } catch (cause) { if (current === revision) error.value = messageFor(cause) }
  finally { generatingSql.value = false }
}
const runTest = async () => {
  if (busy.value) return
  testing.value = true
  errorTitle.value = 'SQL test failed'
  result.value = null
  error.value = ''
  const current = revision
  try {
    const response = await testQuery({ connectionId: connectionId.value, sql: sql.value })
    if (current !== revision) return
    result.value = response
    if (!response.ok) error.value = `${t(response.messageKey || response.message)}${response.details ? ` ${response.details}` : ''}`
  } finally { testing.value = false }
}
const save = async () => {
  if (busy.value) return
  saving.value = true
  errorTitle.value = 'Could not save query'
  error.value = ''
  const current = revision
  try {
    const response = await saveQuery({ connectionId: connectionId.value, queryName: queryName.value, sql: sql.value })
    if (current !== revision) return
    if (response.ok) saved.value = true
    else error.value = t(response.messageKey || response.message)
  } finally { saving.value = false }
}
</script>

<template>
  <UPage class="px-4 sm:px-6 lg:px-8">
    <UPageHeader 
      title="SQL workspace" 
      description="Ask a question, refine the SQL, and test it against your database."
      class="pb-6"
    >
      <template #links>
        <div class="flex items-center gap-2 sm:gap-3">
          <UButton to="/" color="neutral" variant="soft" icon="i-lucide-arrow-left" label="Dashboard" />
          <UButton to="/queries" color="neutral" variant="outline" icon="i-lucide-library" label="Saved queries" />
          <UButton to="/connections" color="neutral" variant="outline" icon="i-lucide-database" label="Connections" />
        </div>
      </template>
    </UPageHeader>
    <UPageBody class="space-y-6 sm:space-y-8">
      <div v-if="error || modelError" role="alert" aria-live="assertive" class="sticky top-2 z-30 mb-6">
        <AppAlert kind="error" :title="error ? errorTitle : 'Local model unavailable'">
          <p>{{ error || modelError }}</p>
          <UButton v-if="schemaError && connectionId" :to="`/connections/${connectionId}`" class="mt-3" color="neutral" variant="outline" label="Check connection settings" />
        </AppAlert>
      </div>
      <AppAlert v-if="!connections?.ok" kind="error" title="Could not load connections">
        <p>{{ t(connections?.messageKey || 'connections.list.errors.unexpected') }}</p>
        <UButton class="mt-3" label="Retry" color="neutral" variant="outline" @click="reloadConnections()" />
      </AppAlert>
      <UPageCard v-else-if="!connectionOptions.length" title="Connect a database first" description="Add a PostgreSQL connection to generate and test queries.">
        <UButton to="/connections/new" label="Add connection" icon="i-lucide-database" />
      </UPageCard>
      <div v-else class="grid min-w-0 gap-6 lg:grid-cols-2">
        <div class="min-w-0 space-y-6">
          <UPageCard title="1. Choose your database" icon="i-lucide-database" class="space-y-4 sm:space-y-6">
            <UFormField label="Database connection" name="connection">
              <USelect v-model="connectionId" :items="connectionOptions" :disabled="busy" class="w-full" />
            </UFormField>
            <UButton v-if="connectionId" :to="`/connections/${connectionId}`" color="neutral" variant="link" icon="i-lucide-settings-2" label="Edit or test this connection" />
            <AppAlert v-if="schemaError" kind="error" title="Schema unavailable">{{ schemaError }}</AppAlert>
            <div class="flex flex-wrap items-center gap-3 sm:gap-4">
              <UButton label="Read schema" color="neutral" variant="outline" :loading="schemaLoading" :disabled="busy || !connectionId" @click="inspectSchema" />
              <span v-if="schemaColumns" class="text-sm text-muted">{{ schemaColumns }} columns available</span>
            </div>
            <details v-if="schema" class="text-sm">
              <summary class="cursor-pointer font-medium">Database schema</summary>
              <pre class="mt-3 max-h-64 overflow-auto rounded-lg bg-elevated p-4 sm:p-6 text-xs">{{ schema }}</pre>
            </details>
            <p v-else-if="schemaLoaded && schemaColumns === 0" class="text-sm text-muted">No accessible tables found.</p>
          </UPageCard>

          <UPageCard title="2. Ask in plain English" icon="i-lucide-sparkles" description="Optional. Generate SQL locally in your browser." class="space-y-4 sm:space-y-6">
            <p v-if="checking" role="status" class="text-sm text-muted">Checking for downloaded models…</p>
            <AppAlert v-else-if="!supported" kind="warning" title="Local AI is unavailable">
              Use a browser with WebGPU enabled on HTTPS or localhost. You can still write and test SQL below.
            </AppAlert>
            <template v-else>
              <p v-if="!ready" class="text-sm text-muted">
                {{ selectedCached ? 'A cached model is available. Load it to start asking questions.' : 'Download a local model to ask questions. The first download can be large and take several minutes.' }}
                Downloads are cached for this site and browser; models downloaded on another site may not be available here.
              </p>
              <UFormField label="Local model" name="model" description="Smaller models use less memory. GPU memory estimates are not download sizes.">
                <USelect v-model="selectedModel" :items="models" :disabled="loading || busy" class="w-full" />
              </UFormField>
              <div class="flex flex-wrap gap-2 sm:gap-3">
                <UButton v-if="!ready" :label="selectedCached ? 'Load cached model' : 'Download and load model'" color="neutral" variant="outline" icon="i-lucide-download" :loading="loading" :disabled="loading || busy || !models.length" @click="load" />
                <UButton v-if="loading" label="Cancel download" color="neutral" variant="ghost" @click="stop" />
                <UBadge v-if="ready" label="Model ready · runs locally" color="success" variant="subtle" />
              </div>
              <progress v-if="loading" :value="progress" max="100" class="w-full" aria-label="Model loading progress" />
              <p v-if="status" role="status" class="break-words text-sm text-muted">{{ status }}</p>
              <UFormField v-if="ready" label="What would you like to know?" name="question" description="The selected database schema is fetched before every generation.">
                <UTextarea v-model="question" placeholder="Show me monthly sales" :rows="3" :maxlength="2000" :disabled="busy" class="w-full" />
              </UFormField>
              <UButton v-if="ready" label="Generate SQL" icon="i-lucide-sparkles" :loading="generatingSql" :disabled="busy || !question.trim() || !connectionId" @click="generateSql" />
            </template>
            <AppAlert v-if="modelError" kind="error" title="Model could not be loaded">{{ modelError }}</AppAlert>
          </UPageCard>

          <UPageCard title="3. Edit and test SQL" icon="i-lucide-code" description="Generated SQL appears here. Edit it freely, or write your own query." class="space-y-4 sm:space-y-6">
            <UFormField label="SQL query" name="sql" description="Tests run as read-only queries with a row limit and timeout.">
              <UTextarea v-model="sql" :rows="12" :maxlength="20000" :disabled="busy" spellcheck="false" placeholder="SELECT ..." class="w-full" :ui="{ base: 'font-mono text-sm' }" />
            </UFormField>
            <AppAlert v-if="error" kind="error" title="Could not complete the request">{{ error }}</AppAlert>
            <UButton label="Test SQL" icon="i-lucide-play" :loading="testing" :disabled="busy || !connectionId || !sql.trim()" @click="runTest" />
            <div class="border-t border-default pt-6 sm:pt-8">
              <UFormField label="Query name" name="queryName" description="Save this query to make it available when adding a dashboard widget.">
                <UInput v-model="queryName" placeholder="Monthly sales" :disabled="busy" class="w-full" />
              </UFormField>
              <UButton class="mt-4 sm:mt-6" label="Save query" color="neutral" variant="outline" icon="i-lucide-save" :loading="saving" :disabled="busy || saved || !queryName.trim() || !sql.trim() || !connectionId" @click="save" />
              <p v-if="saved" role="status" class="mt-4 sm:mt-6 text-sm text-success">Query saved. It is now available in the dashboard widget builder.</p>
            </div>
          </UPageCard>
        </div>
        <UPageCard class="min-w-0 self-start lg:sticky lg:top-28 space-y-4 sm:space-y-6" title="Query results" icon="i-lucide-table-2" description="Results from your latest SQL test appear here.">
          <div v-if="testing" role="status" class="py-16 text-center text-muted">Running your query…</div>
          <template v-else-if="result?.ok">
            <p role="status" class="text-sm text-muted">{{ result.rows?.length ?? 0 }} rows returned · Preview limited to {{ result.rowLimit }} rows</p>
            <div v-if="result.rows?.length" class="max-h-[65vh] overflow-auto rounded-lg border border-default">
              <table class="w-full text-left text-sm">
                <caption class="sr-only">SQL test results</caption>
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
            <p v-else class="py-12 text-center text-muted">The query succeeded but returned no rows.</p>
          </template>
          <p v-else-if="result && !result.ok" role="status" class="py-12 text-center text-muted">The test failed. Review the error beside the SQL editor and try again.</p>
          <div v-else class="space-y-4 sm:space-y-6 py-16 text-center text-muted">
            <UIcon name="i-lucide-table-2" class="size-10" />
            <p>Write or generate SQL, then select Test SQL.</p>
          </div>
        </UPageCard>
      </div>
    </UPageBody>
  </UPage>
</template>

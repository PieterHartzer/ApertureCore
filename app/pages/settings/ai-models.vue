<script setup lang="ts">
import { useAIModels } from '~/composables/useAIModels'
const ai = useAIModels()
const { settings, error, checking } = ai
const busy = ref(false)
const notice = ref('')
const setup = ref(false)
const providerType = ref<'openai' | 'lmstudio' | 'webllm'>('openai')
watch(providerType, () => { apiKey.value = ''; choosingId.value = ''; selectedIds.value = []; available.value = [] })
const name = ref('')
const baseUrl = ref('http://localhost:1234/v1')
const apiKey = ref('')
const editingId = ref('')
const choosingId = ref('')
const available = ref<string[]>([])
const selectedIds = ref<string[]>([])
const renameId = ref('')
const renameValue = ref('')
const removal = ref<{ action: string, id: string, label: string } | null>(null)
const perform = async (action: () => Promise<unknown>) => {
  busy.value = true; error.value = ''; notice.value = ''
  try { await action() } catch (cause) {
    const failure = cause as { data?: { statusMessage?: string }, message?: string }
    if (!ai.sessionExpired.value) error.value = failure.data?.statusMessage ?? failure.message ?? 'Request failed. Please retry.'
  } finally { busy.value = false }
}
const begin = (type: typeof providerType.value) => {
  providerType.value = type; name.value = ''; apiKey.value = ''; editingId.value = ''; choosingId.value = ''; available.value = []; selectedIds.value = []; setup.value = true
}
const discover = async (id: string) => {
  available.value = await ai.availableModels(id)
  choosingId.value = id; selectedIds.value = []
  notice.value = available.value.length ? 'Connection successful. Select models that support text chat.' : 'Connection succeeded, but no candidate chat models were returned. Load a chat model on your server and refresh.'
}
const saveConnection = () => perform(async () => {
  const id = await ai.update({ action: 'connection', id: editingId.value || undefined, providerType: providerType.value, name: name.value, baseUrl: baseUrl.value, ...(providerType.value === 'openai' && apiKey.value ? { apiKey: apiKey.value } : {}) })
  if (!id) return
  if (providerType.value === 'lmstudio') ai.sessionKeys.set(id, apiKey.value)
  apiKey.value = ''; editingId.value = id
  await discover(id)
})
const addModels = () => perform(async () => {
  await ai.update({ action: 'models', id: choosingId.value || undefined, providerType: providerType.value, modelIds: selectedIds.value })
  setup.value = false; choosingId.value = ''; selectedIds.value = []; available.value = []
})
const edit = (id: string) => {
  const connection = settings.value.connections.find(item => item.id === id)
  if (!connection) return
  begin(connection.providerType); editingId.value = id; name.value = connection.name; baseUrl.value = connection.baseUrl
}
const browserStatus = (id: string) => ai.local.readyModel.value === id ? 'Ready' : ai.local.models.value.find(model => model.value === id)?.cached ? 'Weights cached · load to verify' : 'Not downloaded in this browser'
const loadBrowser = (id: string) => perform(async () => { ai.selectedModel.value = id; await ai.load() })
</script>
<template>
  <UPage class="mx-auto max-w-5xl px-4 sm:px-8">
    <UPageHeader :headline="$t('interface.settingsHeadline')" :title="$t('interface.aiModels')" :description="$t('interface.settingsChooseWhereYourSQLAssistantRuns')" />
    <UPageBody class="space-y-8">
      <UAlert v-if="error || ai.local.error.value" color="error" :title="$t('interface.couldNotCompleteTheRequest')" :description="localizeAppMessage($t, error || ai.local.error.value)" />
      <UButton v-if="ai.sessionExpired.value" :to="{ path: '/login', query: { callbackRedirectUrl: '/settings/ai-models' } }" :label="$t('interface.signInAgain')" />
      <p v-if="notice" role="status" class="text-sm text-muted">{{ localizeAppMessage($t, notice) }}</p>
      <div class="flex flex-wrap gap-3">
        <UButton :label="$t('interface.addAIProvider')" icon="i-lucide-plus" @click="begin('openai')" />
        <UButton :label="$t('interface.addDownloadBrowserModel')" color="neutral" variant="soft" @click="begin('webllm')" />
        <UButton :label="$t('interface.refreshSettings')" color="neutral" variant="ghost" :loading="checking" @click="perform(ai.refresh)" />
      </div>
      <section v-if="setup" :aria-label="$t('interface.addAIProvider2')" class="rounded-2xl bg-elevated/70 p-6 backdrop-blur space-y-5">
        <h2 class="text-lg font-semibold">{{ editingId ? $t('interface.editConnection') : $t('interface.chooseAProvider') }}</h2>
        <UFormField :label="$t('interface.provider')"><USelect v-model="providerType" :disabled="!!editingId || busy" :items="[{ label: $t('interface.openAI'), value: 'openai' }, { label: $t('interface.lmStudio'), value: 'lmstudio' }, { label: $t('interface.browserModelWebLLM'), value: 'webllm' }]" /></UFormField>
        <p class="text-sm text-muted">{{ providerType === 'openai' ? $t('interface.cloudInferenceYourQuestionAndDatabaseSchemaAreSentTo') : providerType === 'lmstudio' ? $t('interface.connectDirectlyFromThisBrowserToLMStudioStartThe') : $t('interface.runSupportedQwenCoderModelsOnYourGPUDownloadsPersist') }}</p>
        <form v-if="providerType !== 'webllm'" class="space-y-4" @submit.prevent="saveConnection">
          <UFormField :label="$t('interface.connectionName')" required><UInput v-model="name" required :maxlength="250" class="w-full" /></UFormField>
          <UFormField v-if="providerType === 'lmstudio'" :label="$t('interface.serverURL')" required><UInput v-model="baseUrl" type="url" required class="w-full" /></UFormField>
          <UFormField :label="providerType === 'openai' ? $t('interface.apiKey') : $t('interface.apiKeyOptionalThisPageSessionOnly')" :description="editingId && providerType === 'openai' ? $t('interface.leaveBlankToRetainYourStoredKey') : undefined"><UInput v-model="apiKey" type="password" autocomplete="off" :required="providerType === 'openai' && !editingId" class="w-full" /></UFormField>
          <UButton type="submit" :label="$t('interface.saveAndTestConnection')" :loading="busy" />
        </form>
        <template v-else>
          <p v-if="!ai.local.supported.value" role="alert">{{ $t('interface.yourBrowserOrGraphicsHardwareDoesNotSupportWebGPUUse') }}</p>
          <UFormField :label="$t('interface.browserModel')" :description="$t('interface.parameterCountsAndEstimatedGPUMemoryAreIncludedInEach')"><USelect v-model="selectedIds" multiple :items="localizeModelOptions($t, ai.local.models.value)" class="w-full" /></UFormField>
          <UButton :label="$t('interface.addSelectedBrowserModels')" :disabled="!selectedIds.length || busy" @click="addModels" />
        </template>
        <UButton color="neutral" variant="ghost" :label="$t('interface.closeSetup')" @click="setup = false; apiKey = ''" />
      </section>
      <section v-if="choosingId && available.length" :aria-label="$t('interface.availableModels')" class="space-y-4">
        <h2 class="text-lg font-semibold">{{ $t('interface.availableModels') }}</h2>
        <p class="text-sm text-muted">{{ $t('interface.discoveryIdentifiesCandidateModelsAccessAndChatCompatibilityAreVerified') }}</p>
        <UFormField :label="$t('interface.modelsToAdd')"><USelect v-model="selectedIds" multiple :items="available" class="w-full" /></UFormField>
        <UButton :label="$t('interface.addSelectedModels')" :disabled="!selectedIds.length || busy" @click="addModels" />
      </section>
      <section :aria-label="$t('interface.configuredModels')" class="divide-y divide-default">
        <p v-if="!settings.models.length" class="py-8 text-muted">{{ $t('interface.noAIModelsConfiguredAddAProviderOrABrowser') }}</p>
        <article v-for="model in settings.models" :key="model.id" class="flex flex-wrap items-center justify-between gap-4 py-5">
          <div><h2 class="font-medium">{{ model.displayName }} <UBadge v-if="model.isDefault" :label="$t('interface.default2')" variant="subtle" /></h2><p class="text-sm text-muted">{{ ai.connectionFor(model)?.name ?? $t('interface.browserModels') }} · {{ model.providerType === 'webllm' ? localizeAppMessage($t, browserStatus(model.modelId)) : localizeAppMessage($t, ai.connectionStatus.value[model.providerConnectionId ?? ''] ?? $t('interface.connectionNotCheckedTestBelow')) }}</p></div>
          <div class="flex flex-wrap gap-2">
            <UButton v-if="!model.isDefault" :label="$t('interface.setDefault')" color="neutral" variant="ghost" :disabled="busy" @click="perform(() => ai.update({ action: 'default', id: model.id }))" />
            <UButton :label="$t('interface.rename')" color="neutral" variant="ghost" @click="renameId = model.id; renameValue = model.displayName" />
            <template v-if="model.providerType === 'webllm'">
              <UButton :label="ai.local.readyModel.value === model.modelId ? $t('interface.reload') : $t('interface.downloadLoad')" color="neutral" variant="soft" :disabled="busy || ai.local.loading.value" @click="loadBrowser(model.id)" />
              <UButton v-if="ai.local.readyModel.value === model.modelId" :label="$t('interface.unload')" color="neutral" variant="ghost" @click="ai.stop" />
              <UButton :label="$t('interface.deleteDownloadedFiles')" color="neutral" variant="ghost" @click="removal = { action: 'cache', id: model.modelId, label: model.displayName }" />
            </template>
            <UButton :label="$t('interface.remove')" color="error" variant="ghost" @click="removal = { action: 'remove', id: model.id, label: model.displayName }" />
          </div>
        </article>
      </section>
      <div v-if="ai.local.loading.value" role="status" class="space-y-3"><UProgress :model-value="ai.local.progress.value" /><p>{{ localizeAppMessage($t, ai.local.status.value) }}</p><UButton :label="$t('interface.cancelDownload')" color="neutral" @click="ai.stop" /></div>
      <section :aria-label="$t('interface.providerConnections')" class="space-y-4">
        <h2 class="text-lg font-semibold">{{ $t('interface.providerConnections') }}</h2>
        <div v-for="connection in settings.connections" :key="connection.id" class="flex flex-wrap justify-between gap-3 py-3">
          <div><p class="font-medium">{{ connection.name }}</p><p class="text-sm text-muted">{{ connection.baseUrl }}</p><p role="status" class="text-sm text-muted">{{ localizeAppMessage($t, ai.connectionStatus.value[connection.id] ?? $t('interface.connectionNotChecked')) }}</p></div>
          <div class="flex flex-wrap gap-2"><UButton :label="$t('interface.testRefreshAvailableModels')" color="neutral" variant="ghost" :disabled="busy" @click="perform(async () => { providerType = connection.providerType; await discover(connection.id) })" /><UButton :label="$t('interface.editConnection')" color="neutral" variant="ghost" @click="edit(connection.id)" /><UButton :label="$t('interface.removeConnection')" color="error" variant="ghost" @click="removal = { action: 'removeConnection', id: connection.id, label: connection.name }" /></div>
        </div>
      </section>
      <UModal :open="!!renameId" :title="$t('interface.renameModel')" @update:open="renameId = ''"><template #body><form class="space-y-4" @submit.prevent="perform(async () => { await ai.update({ action: 'rename', id: renameId, name: renameValue }); renameId = '' })"><UFormField :label="$t('interface.displayName')"><UInput v-model="renameValue" required :maxlength="250" /></UFormField><UButton type="submit" :label="$t('interface.saveName')" :loading="busy" /></form></template></UModal>
      <UModal :open="!!removal" :title="$t('interface.confirmRemoval')" @update:open="removal = null"><template #body><p>{{ $t('interface.removeRemovingAConnectionAlsoRemovesItsConfiguredModelsIf', { value1: removal?.label }) }}</p><div class="mt-5 flex gap-3"><UButton :label="$t('interface.remove')" color="error" :loading="busy" @click="perform(async () => { if (!removal) return; if (removal.action === 'cache') await ai.local.deleteDownload(removal.id); else await ai.update({ action: removal.action, id: removal.id }); removal = null })" /><UButton :label="$t('interface.cancel')" color="neutral" @click="removal = null" /></div></template></UModal>
    </UPageBody>
  </UPage>
</template>

<script setup lang="ts">
import { useAIModels } from '~/composables/useAIModels'
import { CLOUD_AI_PROVIDERS, isCloudAIProvider, type CloudAIProviderType } from '#shared/utils/ai-provider-catalog'

type ProviderKey = CloudAIProviderType | 'lmstudio'

const ai = useAIModels()
const { settings, error } = ai
const { t } = useI18n()
const busy = ref(false)
const notice = ref('')
const editing = ref<ProviderKey | 'browser' | null>(null)
const apiKey = ref('')
const baseUrl = ref('')
const deployments = ref('')
const confirmDisconnect = ref(false)

const providers = computed<{ key: ProviderKey, name: string, description: string }[]>(() => [
  ...(Object.keys(CLOUD_AI_PROVIDERS) as CloudAIProviderType[]).map(key => ({
    key,
    name: CLOUD_AI_PROVIDERS[key].label,
    description: t('ai.cloud.description', { provider: CLOUD_AI_PROVIDERS[key].label })
  })),
  { key: 'lmstudio' as const, name: t('ai.local.name'), description: t('ai.local.description') }
])
const connectionFor = (key: ProviderKey) => settings.value.connections.find(connection => connection.providerType === key)
const modelCount = (key: ProviderKey) => settings.value.models.filter(model => model.providerConnectionId === connectionFor(key)?.id).length
const browserModels = computed(() => settings.value.models.filter(model => model.providerType === 'webllm'))
const nameOf = (key: ProviderKey) => isCloudAIProvider(key) ? CLOUD_AI_PROVIDERS[key].label : t('ai.local.name')
const editingCloud = computed(() => editing.value && editing.value !== 'browser' && isCloudAIProvider(editing.value) ? CLOUD_AI_PROVIDERS[editing.value] : null)
const editingConnection = computed(() => editing.value && editing.value !== 'browser' ? connectionFor(editing.value) : undefined)
const statusOf = (key: ProviderKey) => !connectionFor(key)
  ? t('ai.status.notSetUp')
  : modelCount(key) ? t('ai.status.connected') : t('ai.status.attention')

const perform = async (action: () => Promise<unknown>) => {
  busy.value = true
  error.value = ''
  notice.value = ''
  try {
    await action()
  } catch (cause) {
    const failure = cause as { data?: { statusMessage?: string }, statusMessage?: string, message?: string }
    if (!ai.sessionExpired.value) error.value = failure.data?.statusMessage ?? failure.statusMessage ?? failure.message ?? 'Request failed. Please retry.'
  } finally {
    busy.value = false
  }
}
const open = (key: ProviderKey | 'browser') => {
  apiKey.value = ''
  error.value = ''
  confirmDisconnect.value = false
  if (key !== 'browser') {
    const connection = connectionFor(key)
    baseUrl.value = key === 'azure' ? connection?.baseUrl.replace(/\/openai\/v1$/, '') ?? '' : isCloudAIProvider(key) ? '' : connection?.baseUrl ?? ''
    deployments.value = settings.value.models.filter(model => model.providerConnectionId === connection?.id).map(model => model.modelId).join(', ')
  }
  editing.value = key
}
const addModels = async (key: ProviderKey, id: string) => {
  const names = key === 'azure' ? deployments.value.split(',').map(name => name.trim()).filter(Boolean) : undefined
  const modelIds = await ai.availableModels(id, names)
  if (modelIds.length) await ai.update({ action: 'models', id, providerType: key, modelIds: modelIds.slice(0, 100), ...(names ? { replace: true } : {}) })
  return modelIds.length
}
const save = () => perform(async () => {
  const key = editing.value
  if (!key || key === 'browser') return
  const cloud = isCloudAIProvider(key)
  const id = await ai.update({ action: 'connection', id: connectionFor(key)?.id, providerType: key, name: nameOf(key), baseUrl: baseUrl.value, ...(cloud && apiKey.value ? { apiKey: apiKey.value } : {}) })
  if (!id) return
  if (!cloud && apiKey.value) ai.sessionKeys.set(id, apiKey.value)
  apiKey.value = ''
  await addModels(key, id)
  editing.value = null
  notice.value = t('ai.connectedNotice', { provider: nameOf(key) })
})
const refreshModels = () => perform(async () => {
  const key = editing.value
  const id = editingConnection.value?.id
  if (!key || key === 'browser' || !id) return
  notice.value = t('ai.modelsFound', { count: await addModels(key, id) })
  editing.value = null
})
const disconnect = () => perform(async () => {
  await ai.update({ action: 'removeConnection', id: editingConnection.value?.id })
  editing.value = null
})
const browserOption = (modelId: string) => ai.local.models.value.find(option => option.value === modelId)
</script>

<template>
  <UPage>
    <UPageHeader :title="$t('ai.title')" :description="$t('ai.subtitle')" />
    <UPageBody>
      <!-- While a provider dialog is open, its error shows in the dialog instead. -->
      <UAlert v-if="error && !editing" color="error" :title="$t('interface.couldNotCompleteTheRequest')" :description="localizeAppMessage($t, error)" />
      <UButton v-if="ai.sessionExpired.value" :to="{ path: '/login', query: { callbackRedirectUrl: '/settings/ai-models' } }" :label="$t('interface.signInAgain')" />
      <p v-if="notice" role="status" class="text-sm text-success">{{ notice }}</p>

      <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        <article class="flex flex-col gap-2 rounded-[10px] bg-[var(--surface)] p-4 ring ring-primary/50 backdrop-blur-md">
          <div class="flex items-center gap-2">
            <h2 class="flex-1 text-sm font-semibold text-highlighted">{{ $t('ai.browser.name') }}</h2>
            <UBadge :label="$t('interface.default2')" variant="subtle" />
          </div>
          <p class="flex-1 text-sm text-muted">{{ $t('ai.browser.description') }}</p>
          <div class="flex items-center justify-between gap-2">
            <span class="text-xs text-success">{{ ai.local.supported.value ? $t('ai.status.ready') : '' }}</span>
            <UButton color="neutral" variant="outline" size="sm" :label="$t('ai.actions.manage')" @click="open('browser')" />
          </div>
        </article>

        <article v-for="provider in providers" :key="provider.key" class="flex flex-col gap-2 rounded-[10px] bg-[var(--surface)] p-4 ring ring-default backdrop-blur-md">
          <h2 class="text-sm font-semibold text-highlighted">{{ provider.name }}</h2>
          <p class="flex-1 text-sm text-muted">{{ provider.description }}</p>
          <div class="flex items-center justify-between gap-2">
            <span class="text-xs" :class="modelCount(provider.key) ? 'text-success' : 'text-muted'">{{ statusOf(provider.key) }}</span>
            <UButton :color="connectionFor(provider.key) ? 'neutral' : 'primary'" :variant="connectionFor(provider.key) ? 'outline' : 'solid'" size="sm" :label="connectionFor(provider.key) ? $t('ai.actions.manage') : $t('ai.actions.connect')" @click="open(provider.key)" />
          </div>
        </article>
      </div>

      <UModal :open="editing === 'browser'" :title="$t('ai.browser.name')" :description="$t('ai.browser.description')" @update:open="editing = null">
        <template #body>
          <p v-if="!ai.local.supported.value" role="alert" class="text-sm text-warning">{{ $t('interface.yourBrowserOrGraphicsHardwareDoesNotSupportWebGPUUse') }}</p>
          <ul v-else class="divide-y divide-default">
            <li v-for="model in browserModels" :key="model.id" class="flex flex-wrap items-center justify-between gap-2 py-2.5">
              <div class="min-w-0">
                <p class="truncate text-sm text-highlighted">{{ browserOption(model.modelId)?.label ?? model.displayName }}</p>
                <p class="text-xs text-muted">{{ browserOption(model.modelId)?.cached ? $t('ai.cached') : $t('ai.notCached') }}</p>
              </div>
              <UButton v-if="browserOption(model.modelId)?.cached" color="neutral" variant="ghost" size="xs" :label="$t('interface.deleteDownloadedFiles')" :disabled="busy" @click="perform(() => ai.local.deleteDownload(model.modelId))" />
            </li>
          </ul>
          <UAlert v-if="error" class="mt-4" color="error" variant="subtle" :title="$t('interface.couldNotCompleteTheRequest')" :description="localizeAppMessage($t, error)" />
        </template>
      </UModal>

      <UModal :open="!!editing && editing !== 'browser'" :title="editing && editing !== 'browser' ? nameOf(editing) : ''" @update:open="editing = null">
        <template #body>
          <form id="ai-provider-form" class="space-y-4" @submit.prevent="save">
            <UFormField v-if="editing === 'azure'" :label="$t('ai.fields.azureEndpoint')" :description="$t('ai.fields.azureEndpointHint')" required>
              <UInput v-model="baseUrl" type="url" required :placeholder="$t('ai.fields.azureEndpointPlaceholder')" class="w-full" />
            </UFormField>
            <UFormField v-if="editingCloud" :label="$t('ai.fields.apiKey')" :description="editingConnection ? $t('ai.fields.keepKey') : $t('ai.fields.apiKeyHint')" :required="!editingConnection">
              <template #hint><a :href="editingCloud.keyUrl" target="_blank" rel="noopener" class="text-xs text-primary hover:underline">{{ $t('ai.fields.getKey') }}</a></template>
              <UInput v-model="apiKey" type="password" autocomplete="off" :required="!editingConnection" class="w-full" />
            </UFormField>
            <UFormField v-if="editing === 'azure'" :label="$t('ai.fields.azureDeployments')" :description="$t('ai.fields.azureDeploymentsHint')" required>
              <UInput v-model="deployments" required :placeholder="$t('ai.fields.azureDeploymentsPlaceholder')" class="w-full" />
            </UFormField>
            <template v-else>
              <UFormField :label="$t('ai.fields.url')" :description="$t('ai.fields.urlHint')" required>
                <UInput v-model="baseUrl" type="url" required :placeholder="$t('ai.fields.urlPlaceholder')" class="w-full" />
              </UFormField>
              <UFormField :label="$t('ai.fields.serverKey')">
                <UInput v-model="apiKey" type="password" autocomplete="off" class="w-full" />
              </UFormField>
            </template>
          </form>
          <UAlert v-if="error" class="mt-4" color="error" variant="subtle" :title="$t('interface.couldNotCompleteTheRequest')" :description="localizeAppMessage($t, error)" data-provider-error />
          <p v-if="confirmDisconnect" role="alert" class="mt-4 text-sm text-error">{{ $t('ai.disconnectConfirm', { provider: editing && editing !== 'browser' ? nameOf(editing) : '' }) }}</p>
        </template>
        <template #footer>
          <div class="flex w-full flex-wrap items-center justify-between gap-2">
            <div class="flex gap-2">
              <UButton v-if="editingConnection" color="error" variant="ghost" :label="$t('ai.actions.disconnect')" :loading="busy && confirmDisconnect" @click="confirmDisconnect ? disconnect() : confirmDisconnect = true" />
              <UButton v-if="editingConnection && !confirmDisconnect && editing !== 'azure'" color="neutral" variant="ghost" :label="$t('ai.actions.refresh')" :disabled="busy" @click="refreshModels" />
            </div>
            <UButton type="submit" form="ai-provider-form" :label="$t('ai.actions.save')" :loading="busy && !confirmDisconnect" :disabled="busy" />
          </div>
        </template>
      </UModal>
    </UPageBody>
  </UPage>
</template>

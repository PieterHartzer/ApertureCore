<script setup lang="ts">
import SavedSqlQueryForm from '~/components/database/SavedSqlQueryForm.vue'
import AppAlert from '~/components/ui/AppAlert.vue'
import AppLocaleSelect from '~/components/ui/AppLocaleSelect.vue'
import { useSavedDatabaseConnections } from '~/composables/database/useSavedDatabaseConnections'
import { useSavedSqlQuerySave } from '~/composables/database/useSavedSqlQuerySave'
import { useNotifications } from '~/composables/ui/useNotifications'
import type { SavedSqlQueryInput } from '~/types/saved-sql-queries'
import { translateMessage } from '~/utils/translateMessage'

const { t } = useI18n()
const { success } = useNotifications()
const { saveQuery } = useSavedSqlQuerySave()
const requestFetch = import.meta.server
  ? useRequestFetch()
  : $fetch
const { listConnections } = useSavedDatabaseConnections(requestFetch)
const { data: connectionsResponse, status } = await useAsyncData(
  'saved-database-connections:query-form',
  listConnections
)
const isSaving = ref(false)
const saveErrorMessage = ref('')

const isLoading = computed(() => {
  return status.value === 'pending'
})

const connectionOptions = computed(() => {
  if (!connectionsResponse.value?.ok) {
    return []
  }

  return (connectionsResponse.value.connections ?? []).map((connection) => ({
    label: connection.connectionName,
    value: connection.id
  }))
})

const connectionsLoadErrorMessage = computed(() => {
  if (!connectionsResponse.value || connectionsResponse.value.ok) {
    return ''
  }

  return translateMessage(
    t,
    connectionsResponse.value.messageKey,
    'connections.list.errors.unexpected'
  )
})

const onSubmit = async (query: SavedSqlQueryInput) => {
  isSaving.value = true
  saveErrorMessage.value = ''

  try {
    const response = await saveQuery(query)
    const message = translateMessage(
      t,
      response.messageKey,
      response.ok
        ? 'queries.save.success'
        : 'queries.save.errors.unexpected'
    )

    if (response.ok) {
      success(message, t('queries.save.notifications.successTitle'))
      await navigateTo('/queries/')
      return
    }

    saveErrorMessage.value = message
  } finally {
    isSaving.value = false
  }
}

const onCancel = async () => {
  if (isSaving.value) {
    return
  }

  await navigateTo('/queries/')
}
</script>

<template>
  <UPage>
    <UPageHeader
      :headline="t('queries.new.headline')"
      :title="t('queries.new.title')"
      :description="t('queries.new.description')"
    >
      <template #links>
        <AppLocaleSelect />
      </template>
    </UPageHeader>

    <UPageBody>
      <AppAlert
        v-if="connectionsLoadErrorMessage"
        kind="error"
        :title="t('queries.new.errors.loadTitle')"
      >
        {{ connectionsLoadErrorMessage }}
      </AppAlert>

      <UPageCard
        v-else-if="isLoading"
        icon="i-lucide-loader-circle"
        :title="t('queries.new.card.title')"
        :description="t('queries.new.loading')"
      />

      <UPageCard
        v-else-if="connectionOptions.length === 0"
        icon="i-lucide-database"
        :title="t('queries.new.emptyConnections.title')"
        :description="t('queries.new.emptyConnections.description')"
      >
        <UButton
          to="/connections/new"
          icon="i-lucide-database-zap"
          :label="t('queries.new.emptyConnections.action')"
        />
      </UPageCard>

      <UPageCard
        v-else
        icon="i-lucide-file-plus-2"
        :title="t('queries.new.card.title')"
        :description="t('queries.new.card.description')"
      >
        <SavedSqlQueryForm
          mode="create"
          :connections="connectionOptions"
          :is-submitting="isSaving"
          :submit-label="t('queries.new.actions.save')"
          :submit-loading-label="t('queries.new.actions.saveLoading')"
          :test-label="t('queries.new.actions.test')"
          :test-loading-label="t('queries.new.actions.testLoading')"
          :cancel-label="t('queries.new.actions.cancel')"
          :error-title="t('queries.save.notifications.errorTitle')"
          :error-message="saveErrorMessage"
          @submit="onSubmit"
          @cancel="onCancel"
        />
      </UPageCard>
    </UPageBody>
  </UPage>
</template>

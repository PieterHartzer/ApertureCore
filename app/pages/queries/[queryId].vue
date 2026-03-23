<script setup lang="ts">
import SavedSqlQueryForm from '~/components/database/SavedSqlQueryForm.vue'
import AppAlert from '~/components/ui/AppAlert.vue'
import AppLocaleSelect from '~/components/ui/AppLocaleSelect.vue'
import { useSavedDatabaseConnections } from '~/composables/database/useSavedDatabaseConnections'
import { useSavedSqlQuery } from '~/composables/database/useSavedSqlQuery'
import { useSavedSqlQueryUpdate } from '~/composables/database/useSavedSqlQueryUpdate'
import { useNotifications } from '~/composables/ui/useNotifications'
import type { SavedSqlQueryInput } from '~/types/saved-sql-queries'
import { translateMessage } from '~/utils/translateMessage'

const route = useRoute()
const { t } = useI18n()
const { success, error } = useNotifications()
const { updateQuery } = useSavedSqlQueryUpdate()
const requestFetch = import.meta.server
  ? useRequestFetch()
  : $fetch
const { getQuery } = useSavedSqlQuery(requestFetch)
const { listConnections } = useSavedDatabaseConnections(requestFetch)
const queryId = computed(() => String(route.params.queryId ?? ''))
const { data: pageResponse, status } = await useAsyncData(
  () => `saved-sql-query:edit:${queryId.value}`,
  async () => {
    const [queryResponse, connectionsResponse] = await Promise.all([
      getQuery(queryId.value),
      listConnections()
    ])

    return {
      queryResponse,
      connectionsResponse
    }
  },
  {
    watch: [queryId]
  }
)
const isSaving = ref(false)
const saveErrorMessage = ref('')

const queryResponse = computed(() => {
  return pageResponse.value?.queryResponse
})

const connectionsResponse = computed(() => {
  return pageResponse.value?.connectionsResponse
})

const initialQuery = computed<SavedSqlQueryInput | null>(() => {
  if (!queryResponse.value?.ok || !queryResponse.value.query) {
    return null
  }

  return {
    queryName: queryResponse.value.query.queryName,
    connectionId: queryResponse.value.query.connectionId,
    sql: queryResponse.value.query.sql
  }
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

const isLoading = computed(() => {
  return status.value === 'pending'
})

const loadErrorMessage = computed(() => {
  if (queryResponse.value && !queryResponse.value.ok) {
    return translateMessage(
      t,
      queryResponse.value.messageKey,
      'queries.edit.errors.unexpected'
    )
  }

  if (connectionsResponse.value && !connectionsResponse.value.ok) {
    return translateMessage(
      t,
      connectionsResponse.value.messageKey,
      'connections.list.errors.unexpected'
    )
  }

  return ''
})

const onSubmit = async (query: SavedSqlQueryInput) => {
  isSaving.value = true
  saveErrorMessage.value = ''

  try {
    const response = await updateQuery(queryId.value, query)
    const message = translateMessage(
      t,
      response.messageKey,
      response.ok
        ? 'queries.update.success'
        : 'queries.update.errors.unexpected'
    )

    if (response.ok) {
      success(message, t('queries.update.notifications.successTitle'))
      await navigateTo('/queries/')
      return
    }

    saveErrorMessage.value = message
    error(message, t('queries.update.notifications.errorTitle'))
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
      :headline="t('queries.edit.headline')"
      :title="t('queries.edit.title')"
      :description="t('queries.edit.description')"
    >
      <template #links>
        <AppLocaleSelect />
      </template>
    </UPageHeader>

    <UPageBody>
      <AppAlert
        v-if="loadErrorMessage"
        kind="error"
        :title="t('queries.edit.errors.loadTitle')"
      >
        {{ loadErrorMessage }}
      </AppAlert>

      <UPageCard
        v-else-if="isLoading || !initialQuery"
        icon="i-lucide-loader-circle"
        :title="t('queries.edit.card.title')"
        :description="t('queries.edit.loading')"
      />

      <UPageCard
        v-else
        icon="i-lucide-pencil-line"
        :title="t('queries.edit.card.title')"
        :description="t('queries.edit.card.description')"
      >
        <SavedSqlQueryForm
          :key="queryId"
          mode="edit"
          :initial-query="initialQuery"
          :connections="connectionOptions"
          :is-submitting="isSaving"
          :submit-label="t('queries.edit.actions.save')"
          :submit-loading-label="t('queries.edit.actions.saveLoading')"
          :test-label="t('queries.edit.actions.test')"
          :test-loading-label="t('queries.edit.actions.testLoading')"
          :cancel-label="t('queries.edit.actions.cancel')"
          :error-title="t('queries.update.notifications.errorTitle')"
          :error-message="saveErrorMessage"
          @submit="onSubmit"
          @cancel="onCancel"
        />
      </UPageCard>
    </UPageBody>
  </UPage>
</template>

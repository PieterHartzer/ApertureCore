<script setup lang="ts">
import AppAlert from '~/components/ui/AppAlert.vue'
import AppLocaleSelect from '~/components/ui/AppLocaleSelect.vue'
import { useSavedDatabaseConnections } from '~/composables/database/useSavedDatabaseConnections'
import { translateMessage } from '~/utils/translateMessage'

const { t } = useI18n()
const { listConnections } = useSavedDatabaseConnections()
const { data: listResponse, status } = await useAsyncData(
  'saved-database-connections',
  listConnections
)

const columns = computed(() => [
  {
    accessorKey: 'connectionName',
    header: t('connections.index.table.columns.connectionName')
  },
  {
    accessorKey: 'databaseType',
    header: t('connections.index.table.columns.databaseType')
  },
  {
    id: 'actions',
    header: t('connections.index.table.columns.actions')
  }
])

const connections = computed(() => {
  return listResponse.value?.ok
    ? listResponse.value.connections ?? []
    : []
})

const isLoading = computed(() => {
  return status.value === 'pending'
})

const listErrorMessage = computed(() => {
  if (!listResponse.value || listResponse.value.ok) {
    return ''
  }

  return translateMessage(
    t,
    listResponse.value.messageKey,
    'connections.list.errors.unexpected'
  )
})

const formatDatabaseType = (databaseType: string) => {
  const key = `database.types.${databaseType}`
  const translatedLabel = t(key)

  return translatedLabel === key
    ? databaseType
    : translatedLabel
}
</script>

<template>
  <UPage>
    <UPageHeader
      :headline="t('connections.index.headline')"
      :title="t('connections.index.title')"
      :description="t('connections.index.description')"
    >
      <template #links>
        <div class="flex items-center gap-3">
          <AppLocaleSelect />
          <UButton
            to="/connections/new"
            icon="i-lucide-plus"
            :label="t('connections.index.actions.new')"
          />
        </div>
      </template>
    </UPageHeader>

    <UPageBody>
      <AppAlert
        v-if="listErrorMessage"
        kind="error"
        :title="t('connections.index.errors.loadTitle')"
      >
        {{ listErrorMessage }}
      </AppAlert>

      <UPageCard
        v-else-if="isLoading || connections.length > 0"
        icon="i-lucide-table-properties"
        :title="t('connections.index.table.title')"
        :description="t('connections.index.table.description')"
      >
        <UTable
          :data="connections"
          :columns="columns"
          :loading="isLoading"
          :empty="t('connections.index.table.empty')"
        >
          <template #databaseType-cell="{ row }">
            {{ formatDatabaseType(row.original.databaseType) }}
          </template>

          <template #actions-cell>
            <div class="flex items-center gap-2">
              <UButton
                type="button"
                color="neutral"
                variant="ghost"
                icon="i-lucide-pencil"
                :label="t('connections.index.table.actions.edit')"
                disabled
              />
              <UButton
                type="button"
                color="error"
                variant="ghost"
                icon="i-lucide-trash-2"
                :label="t('connections.index.table.actions.delete')"
                disabled
              />
            </div>
          </template>
        </UTable>
      </UPageCard>

      <UPageCard
        v-else
        icon="i-lucide-database"
        :title="t('connections.index.empty.title')"
        :description="t('connections.index.empty.description')"
      >
        <UButton
          to="/connections/new"
          icon="i-lucide-database-zap"
          :label="t('connections.index.actions.addFirst')"
        />
      </UPageCard>
    </UPageBody>
  </UPage>
</template>

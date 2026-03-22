<script setup lang="ts">
import AppAlert from '~/components/ui/AppAlert.vue'
import AppLocaleSelect from '~/components/ui/AppLocaleSelect.vue'
import { useSavedSqlQueries } from '~/composables/database/useSavedSqlQueries'
import { translateMessage } from '~/utils/translateMessage'

interface SavedSqlQueryListItem {
  id: string
  queryName: string
  connectionId: string
  connectionName: string
}

const { t } = useI18n()
const requestFetch = import.meta.server
  ? useRequestFetch()
  : $fetch
const { listQueries } = useSavedSqlQueries(requestFetch)
const { data: listResponse, status } = await useAsyncData(
  'saved-sql-queries',
  listQueries
)

const columns = computed(() => [
  {
    accessorKey: 'queryName',
    header: t('queries.index.table.columns.queryName')
  },
  {
    accessorKey: 'connectionName',
    header: t('queries.index.table.columns.connectionName')
  }
])

const queries = computed<SavedSqlQueryListItem[]>(() => {
  return listResponse.value?.ok
    ? listResponse.value.queries ?? []
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
    'queries.list.errors.unexpected'
  )
})
</script>

<template>
  <UPage>
    <UPageHeader
      :headline="t('queries.index.headline')"
      :title="t('queries.index.title')"
      :description="t('queries.index.description')"
    >
      <template #links>
        <div class="flex items-center gap-3">
          <AppLocaleSelect />
          <UButton
            to="/queries/new"
            icon="i-lucide-plus"
            :label="t('queries.index.actions.new')"
          />
        </div>
      </template>
    </UPageHeader>

    <UPageBody>
      <AppAlert
        v-if="listErrorMessage"
        kind="error"
        :title="t('queries.index.errors.loadTitle')"
      >
        {{ listErrorMessage }}
      </AppAlert>

      <UPageCard
        v-else-if="isLoading || queries.length > 0"
        icon="i-lucide-file-code-2"
        :title="t('queries.index.table.title')"
        :description="t('queries.index.table.description')"
      >
        <UTable
          :data="queries"
          :columns="columns"
          :loading="isLoading"
          :empty="t('queries.index.table.empty')"
        />
      </UPageCard>

      <UPageCard
        v-else
        icon="i-lucide-file-search"
        :title="t('queries.index.empty.title')"
        :description="t('queries.index.empty.description')"
      >
        <UButton
          to="/queries/new"
          icon="i-lucide-file-plus-2"
          :label="t('queries.index.actions.addFirst')"
        />
      </UPageCard>
    </UPageBody>
  </UPage>
</template>

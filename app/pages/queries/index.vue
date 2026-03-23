<script setup lang="ts">
import DeleteSavedSqlQueryDialog from '~/components/database/DeleteSavedSqlQueryDialog.vue'
import AppAlert from '~/components/ui/AppAlert.vue'
import AppLocaleSelect from '~/components/ui/AppLocaleSelect.vue'
import { useSavedSqlQueryDelete } from '~/composables/database/useSavedSqlQueryDelete'
import { useSavedSqlQueries } from '~/composables/database/useSavedSqlQueries'
import { useNotifications } from '~/composables/ui/useNotifications'
import type { SavedSqlQueryDeleteRequest } from '~/types/saved-sql-queries'
import { translateMessage } from '~/utils/translateMessage'

interface SavedSqlQueryListItem {
  id: string
  queryName: string
  connectionId: string
  connectionName: string
}

const { t } = useI18n()
const { success } = useNotifications()
const { deleteQuery } = useSavedSqlQueryDelete()
const requestFetch = import.meta.server
  ? useRequestFetch()
  : $fetch
const { listQueries } = useSavedSqlQueries(requestFetch)
const { data: listResponse, status, refresh } = await useAsyncData(
  'saved-sql-queries',
  listQueries
)
const selectedQuery = ref<SavedSqlQueryListItem | null>(null)
const isDeleteDialogOpen = ref(false)
const isDeleting = ref(false)
const deleteDialogErrorMessage = ref('')

const columns = computed(() => [
  {
    accessorKey: 'queryName',
    header: t('queries.index.table.columns.queryName')
  },
  {
    accessorKey: 'connectionName',
    header: t('queries.index.table.columns.connectionName')
  },
  {
    id: 'actions',
    header: t('queries.index.table.columns.actions')
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

const onDeleteDialogOpenChange = (open: boolean) => {
  isDeleteDialogOpen.value = open

  if (!open) {
    selectedQuery.value = null
    deleteDialogErrorMessage.value = ''
  }
}

const openDeleteDialog = (query: SavedSqlQueryListItem) => {
  selectedQuery.value = query
  deleteDialogErrorMessage.value = ''
  isDeleteDialogOpen.value = true
}

const onDeleteConfirm = async (payload: SavedSqlQueryDeleteRequest) => {
  if (!selectedQuery.value) {
    return
  }

  isDeleting.value = true
  deleteDialogErrorMessage.value = ''

  try {
    const response = await deleteQuery(selectedQuery.value.id, payload)
    const message = translateMessage(
      t,
      response.messageKey,
      response.ok
        ? 'queries.delete.success'
        : 'queries.delete.errors.unexpected'
    )

    if (response.ok) {
      onDeleteDialogOpenChange(false)
      await refresh()
      success(message, t('queries.delete.notifications.successTitle'))
      return
    }

    deleteDialogErrorMessage.value = message
  } finally {
    isDeleting.value = false
  }
}
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
        >
          <template #actions-cell="{ row }">
            <div class="flex items-center gap-2">
              <UButton
                :to="`/queries/${row.original.id}`"
                color="neutral"
                variant="ghost"
                icon="i-lucide-pencil"
                :label="t('queries.index.table.actions.edit')"
              />
              <UButton
                type="button"
                color="error"
                variant="ghost"
                icon="i-lucide-trash-2"
                :label="t('queries.index.table.actions.delete')"
                @click="openDeleteDialog(row.original)"
              />
            </div>
          </template>
        </UTable>
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

      <DeleteSavedSqlQueryDialog
        :open="isDeleteDialogOpen"
        :query-name="selectedQuery?.queryName ?? ''"
        :is-deleting="isDeleting"
        :error-message="deleteDialogErrorMessage"
        @update:open="onDeleteDialogOpenChange"
        @confirm="onDeleteConfirm"
      />
    </UPageBody>
  </UPage>
</template>

import { computed, defineComponent, ref } from 'vue'

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

export default defineComponent({
  components: {
    AppAlert,
    AppLocaleSelect,
    DeleteSavedSqlQueryDialog
  },
  async setup() {
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

    return {
      columns,
      deleteDialogErrorMessage,
      isDeleteDialogOpen,
      isDeleting,
      isLoading,
      listErrorMessage,
      onDeleteConfirm,
      onDeleteDialogOpenChange,
      openDeleteDialog,
      queries,
      selectedQuery,
      t
    }
  }
})

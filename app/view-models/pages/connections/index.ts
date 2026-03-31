import { computed, defineComponent, ref } from 'vue'

import DeleteConnectionDialog from '~/components/database/DeleteConnectionDialog.vue'
import AppAlert from '~/components/ui/AppAlert.vue'
import AppLocaleSelect from '~/components/ui/AppLocaleSelect.vue'
import { useDatabaseConnectionDelete } from '~/composables/database/useDatabaseConnectionDelete'
import { useSavedDatabaseConnections } from '~/composables/database/useSavedDatabaseConnections'
import { useNotifications } from '~/composables/ui/useNotifications'
import { translateMessage } from '~/utils/translateMessage'

interface SavedDatabaseConnectionListItem {
  id: string
  connectionName: string
  databaseType: string
}

interface DeleteConnectionDialogConfirmPayload {
  confirmationName: string
  deleteLinkedQueries: boolean
}

export default defineComponent({
  components: {
    AppAlert,
    AppLocaleSelect,
    DeleteConnectionDialog
  },
  async setup() {
    const { t } = useI18n()
    const { success } = useNotifications()
    const { deleteConnection } = useDatabaseConnectionDelete()
    const requestFetch = import.meta.server
      ? useRequestFetch()
      : $fetch
    const { listConnections } = useSavedDatabaseConnections(requestFetch)
    const { data: listResponse, status, refresh } = await useAsyncData(
      'saved-database-connections',
      listConnections
    )
    const selectedConnection = ref<SavedDatabaseConnectionListItem | null>(null)
    const isDeleteDialogOpen = ref(false)
    const isDeleting = ref(false)
    const deleteDialogErrorMessage = ref('')

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

    const onDeleteDialogOpenChange = (open: boolean) => {
      isDeleteDialogOpen.value = open

      if (!open) {
        selectedConnection.value = null
        deleteDialogErrorMessage.value = ''
      }
    }

    const openDeleteDialog = (connection: SavedDatabaseConnectionListItem) => {
      selectedConnection.value = connection
      deleteDialogErrorMessage.value = ''
      isDeleteDialogOpen.value = true
    }

    const onDeleteConfirm = async (
      payload: DeleteConnectionDialogConfirmPayload
    ) => {
      if (!selectedConnection.value) {
        return
      }

      isDeleting.value = true
      deleteDialogErrorMessage.value = ''

      try {
        const response = await deleteConnection(selectedConnection.value.id, payload)
        const message = translateMessage(
          t,
          response.messageKey,
          response.ok
            ? 'connections.delete.success'
            : 'connections.delete.errors.unexpected'
        )

        if (response.ok) {
          onDeleteDialogOpenChange(false)
          await refresh()
          success(message, t('connections.delete.notifications.successTitle'))
          return
        }

        deleteDialogErrorMessage.value = message
      } finally {
        isDeleting.value = false
      }
    }

    return {
      columns,
      connections,
      deleteDialogErrorMessage,
      formatDatabaseType,
      isDeleteDialogOpen,
      isDeleting,
      isLoading,
      listErrorMessage,
      onDeleteConfirm,
      onDeleteDialogOpenChange,
      openDeleteDialog,
      selectedConnection,
      t
    }
  }
})

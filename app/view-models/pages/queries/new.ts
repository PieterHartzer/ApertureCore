import { computed, defineComponent, ref } from 'vue'

import SavedSqlQueryForm from '~/components/database/SavedSqlQueryForm.vue'
import AppAlert from '~/components/ui/AppAlert.vue'
import AppLocaleSelect from '~/components/ui/AppLocaleSelect.vue'
import { useSavedDatabaseConnections } from '~/composables/database/useSavedDatabaseConnections'
import { useSavedSqlQuerySave } from '~/composables/database/useSavedSqlQuerySave'
import { useNotifications } from '~/composables/ui/useNotifications'
import type { SavedSqlQueryInput } from '~/types/saved-sql-queries'
import { translateMessage } from '~/utils/translateMessage'

export default defineComponent({
  components: {
    AppAlert,
    AppLocaleSelect,
    SavedSqlQueryForm
  },
  async setup() {
    const { t } = useI18n()
    const { success, error } = useNotifications()
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
        error(message, t('queries.save.notifications.errorTitle'))
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

    return {
      connectionOptions,
      connectionsLoadErrorMessage,
      isLoading,
      isSaving,
      onCancel,
      onSubmit,
      saveErrorMessage,
      t
    }
  }
})

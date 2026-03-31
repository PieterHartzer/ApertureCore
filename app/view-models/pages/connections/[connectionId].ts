import { computed, defineComponent } from 'vue'

import ConectionTestForm from '~/components/database/ConectionTestForm.vue'
import AppAlert from '~/components/ui/AppAlert.vue'
import AppLocaleSelect from '~/components/ui/AppLocaleSelect.vue'
import { useSavedDatabaseConnection } from '~/composables/database/useSavedDatabaseConnection'
import type { DatabaseConnection } from '~/types/database'
import { translateMessage } from '~/utils/translateMessage'

export default defineComponent({
  components: {
    AppAlert,
    AppLocaleSelect,
    ConectionTestForm
  },
  async setup() {
    const route = useRoute()
    const { t } = useI18n()
    const requestFetch = import.meta.server
      ? useRequestFetch()
      : $fetch
    const { getConnection } = useSavedDatabaseConnection(requestFetch)
    const connectionId = computed(() => String(route.params.connectionId ?? ''))
    const { data: connectionResponse, status } = await useAsyncData(
      () => `saved-database-connection:${connectionId.value}`,
      () => getConnection(connectionId.value),
      {
        watch: [connectionId]
      }
    )

    const initialConnection = computed<DatabaseConnection | null>(() => {
      if (!connectionResponse.value?.ok || !connectionResponse.value.connection) {
        return null
      }

      return {
        connectionName: connectionResponse.value.connection.connectionName,
        databaseType: connectionResponse.value.connection.databaseType,
        host: connectionResponse.value.connection.host,
        port: connectionResponse.value.connection.port,
        databaseName: connectionResponse.value.connection.databaseName,
        username: connectionResponse.value.connection.username,
        password: '',
        sslMode: connectionResponse.value.connection.sslMode
      }
    })

    const hasStoredPassword = computed(() => {
      return connectionResponse.value?.ok
        ? Boolean(connectionResponse.value.connection?.hasPassword)
        : false
    })

    const isLoading = computed(() => {
      return status.value === 'pending'
    })

    const loadErrorMessage = computed(() => {
      if (!connectionResponse.value || connectionResponse.value.ok) {
        return ''
      }

      return translateMessage(
        t,
        connectionResponse.value.messageKey,
        'connections.edit.errors.unexpected'
      )
    })

    return {
      connectionId,
      hasStoredPassword,
      initialConnection,
      isLoading,
      loadErrorMessage,
      t
    }
  }
})

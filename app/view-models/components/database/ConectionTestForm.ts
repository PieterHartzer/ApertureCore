import { computed, defineComponent, ref, watch, type PropType } from 'vue'

import AppAlert from '~/components/ui/AppAlert.vue'
import { useDatabaseConnectionSave } from '~/composables/database/useDatabaseConnectionSave'
import { useDatabaseConnectionTest } from '~/composables/database/useDatabaseConnectionTest'
import { useDatabaseConnectionUpdate } from '~/composables/database/useDatabaseConnectionUpdate'
import { useNotifications } from '~/composables/ui/useNotifications'
import {
  type DatabaseConnection,
  createEmptyDatabaseConnection,
  DATABASE_SSL_MODES,
  DATABASE_TYPES
} from '~/types/database'
import { translateMessage } from '~/utils/translateMessage'

interface ScreenAlert {
  kind: 'error'
  title: string
  message: string
}

export default defineComponent({
  components: {
    AppAlert
  },
  props: {
    mode: {
      type: String as PropType<'create' | 'edit'>,
      default: 'create'
    },
    connectionId: {
      type: String,
      default: undefined
    },
    initialConnection: {
      type: Object as PropType<DatabaseConnection | null>,
      default: null
    },
    hasStoredPassword: {
      type: Boolean,
      default: false
    }
  },
  setup(props) {
    const connection = ref(createEmptyDatabaseConnection())
    const isTesting = ref(false)
    const isSaving = ref(false)
    const screenAlert = ref<ScreenAlert | null>(null)
    const lastTestedConnectionSignature = ref<string | null>(null)
    const lastSavedConnectionSignature = ref<string | null>(null)

    const { saveConnection } = useDatabaseConnectionSave()
    const { updateConnection } = useDatabaseConnectionUpdate()
    const { testConnection } = useDatabaseConnectionTest()
    const { success } = useNotifications()
    const { t } = useI18n()

    const goToConnections = async () => {
      await navigateTo('/connections/')
    }

    const currentConnectionSignature = computed(() => {
      return JSON.stringify(connection.value)
    })

    const currentConnectionTestSignature = computed(() => {
      return JSON.stringify({
        databaseType: connection.value.databaseType,
        host: connection.value.host,
        port: connection.value.port,
        databaseName: connection.value.databaseName,
        username: connection.value.username,
        password: connection.value.password,
        sslMode: connection.value.sslMode
      })
    })

    const canSave = computed(() => {
      return (
        !isTesting.value &&
        !isSaving.value &&
        lastTestedConnectionSignature.value === currentConnectionTestSignature.value &&
        lastSavedConnectionSignature.value !== currentConnectionSignature.value
      )
    })

    const databaseTypeItems = computed(() => {
      return DATABASE_TYPES.map((type) => ({
        label: t(`database.types.${type}`),
        value: type
      }))
    })

    const sslModeItems = computed(() => {
      return DATABASE_SSL_MODES.map((mode) => ({
        label: t(`database.sslModes.${mode}`),
        value: mode
      }))
    })

    const clearScreenAlert = () => {
      screenAlert.value = null
    }

    const showScreenError = (title: string, message: string) => {
      screenAlert.value = {
        kind: 'error',
        title,
        message
      }
    }

    const formTextPrefix = computed(() => {
      return props.mode === 'edit'
        ? 'connections.edit'
        : 'connections.new'
    })

    const successMessageFallbackKey = computed(() => {
      return props.mode === 'edit'
        ? 'connections.update.success'
        : 'connections.save.success'
    })

    const errorMessageFallbackKey = computed(() => {
      return props.mode === 'edit'
        ? 'connections.update.errors.unexpected'
        : 'connections.save.errors.unexpected'
    })

    const successNotificationTitleKey = computed(() => {
      return props.mode === 'edit'
        ? 'connections.update.notifications.successTitle'
        : 'connections.save.notifications.successTitle'
    })

    const errorNotificationTitleKey = computed(() => {
      return props.mode === 'edit'
        ? 'connections.update.notifications.errorTitle'
        : 'connections.save.notifications.errorTitle'
    })

    const passwordDescription = computed(() => {
      if (props.mode !== 'edit' || !props.hasStoredPassword) {
        return undefined
      }

      return t('connections.edit.fields.password.description')
    })

    const resetForm = (nextConnection: DatabaseConnection) => {
      connection.value = {
        ...nextConnection
      }
      lastTestedConnectionSignature.value =
        props.mode === 'edit'
          ? currentConnectionTestSignature.value
          : null
      lastSavedConnectionSignature.value =
        props.mode === 'edit'
          ? currentConnectionSignature.value
          : null
      clearScreenAlert()
    }

    watch(
      () => props.initialConnection,
      (value) => {
        if (value) {
          resetForm(value)
          return
        }

        if (props.mode === 'create') {
          resetForm(createEmptyDatabaseConnection())
        }
      },
      {
        immediate: true
      }
    )

    watch(currentConnectionSignature, () => {
      clearScreenAlert()
    })

    const onSubmit = async () => {
      isTesting.value = true
      clearScreenAlert()
      lastTestedConnectionSignature.value = null

      try {
        const response = await testConnection(
          connection.value,
          props.mode === 'edit' && props.connectionId
            ? {
                connectionId: props.connectionId
              }
            : undefined
        )
        const message = translateMessage(
          t,
          response.messageKey,
          response.ok
            ? 'connections.test.success'
            : 'connections.test.errors.unexpected'
        )

        if (response.ok) {
          lastTestedConnectionSignature.value = currentConnectionTestSignature.value
          clearScreenAlert()
          success(message, t('connections.test.notifications.successTitle'))
          return
        }

        showScreenError(
          t('connections.test.notifications.errorTitle'),
          message
        )
      } finally {
        isTesting.value = false
      }
    }

    const onSave = async () => {
      if (!canSave.value) {
        return
      }

      isSaving.value = true
      clearScreenAlert()

      try {
        const response =
          props.mode === 'edit' && props.connectionId
            ? await updateConnection(props.connectionId, connection.value)
            : await saveConnection(connection.value)
        const message = translateMessage(
          t,
          response.messageKey,
          response.ok
            ? successMessageFallbackKey.value
            : errorMessageFallbackKey.value
        )

        if (response.ok) {
          lastSavedConnectionSignature.value = currentConnectionSignature.value
          clearScreenAlert()
          success(message, t(successNotificationTitleKey.value))
          await goToConnections()
          return
        }

        showScreenError(
          t(errorNotificationTitleKey.value),
          message
        )
      } finally {
        isSaving.value = false
      }
    }

    const onCancel = async () => {
      if (isTesting.value || isSaving.value) {
        return
      }

      await goToConnections()
    }

    return {
      canSave,
      connection,
      databaseTypeItems,
      formTextPrefix,
      isSaving,
      isTesting,
      onCancel,
      onSave,
      onSubmit,
      passwordDescription,
      screenAlert,
      sslModeItems,
      t
    }
  }
})

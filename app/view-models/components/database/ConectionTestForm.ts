import { computed, defineComponent, ref, watch, type PropType } from 'vue'

import AppAlert from '~/components/ui/AppAlert.vue'
import { useDatabaseConnectionSave } from '~/composables/database/useDatabaseConnectionSave'
import { useDatabaseConnectionTest } from '~/composables/database/useDatabaseConnectionTest'
import { useDatabaseConnectionUpdate } from '~/composables/database/useDatabaseConnectionUpdate'
import { useNotifications } from '~/composables/ui/useNotifications'
import {
  type DatabaseConnection,
  createEmptyDatabaseConnection,
  DEFAULT_PORTS,
  DATABASE_SSL_MODES,
  DATABASE_TYPES
} from '~/types/database'
import { parseConnectionString } from '~/utils/connection-string'
import { translateMessage } from '~/utils/translateMessage'

const READ_ONLY_LOGIN_SQL: Record<DatabaseConnection['databaseType'], string> = {
  postgres: `CREATE ROLE autodash_reader LOGIN PASSWORD 'change-me';
GRANT USAGE ON SCHEMA public TO autodash_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO autodash_reader;`,
  mysql: `CREATE USER 'autodash_reader'@'%' IDENTIFIED BY 'change-me';
GRANT SELECT ON your_database.* TO 'autodash_reader'@'%';`,
  mssql: `CREATE LOGIN autodash_reader WITH PASSWORD = 'change-me';
-- Run the next two statements in your database:
CREATE USER autodash_reader FOR LOGIN autodash_reader;
ALTER ROLE db_datareader ADD MEMBER autodash_reader;`
}

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

    const readOnlyLoginSql = computed(() => READ_ONLY_LOGIN_SQL[connection.value.databaseType])
    const copied = ref(false)
    const copy = async (text: string) => {
      await navigator.clipboard.writeText(text)
      copied.value = true
      setTimeout(() => { copied.value = false }, 2000)
    }

    watch(() => connection.value.databaseType, (next, previous) => {
      if (previous && connection.value.port === DEFAULT_PORTS[previous]) {
        connection.value.port = DEFAULT_PORTS[next]
      }
    })

    // Most providers hand out one connection string; pasting it fills the fields
    // below, so testing, saving and encryption work exactly as with typed fields.
    const entryMode = ref<'string' | 'fields'>(props.mode === 'create' ? 'string' : 'fields')
    const connectionString = ref('')
    const connectionStringError = ref('')
    const entryModeItems = computed(() => [
      { label: t('connections.form.entry.string'), value: 'string', icon: 'i-lucide-link' },
      { label: t('connections.form.entry.fields'), value: 'fields', icon: 'i-lucide-list' }
    ])
    const connectionStringPlaceholder = 'postgres://user:password@host:5432/database?sslmode=require'

    watch(connectionString, (text) => {
      connectionStringError.value = ''

      if (!text.trim()) return

      const parsed = parseConnectionString(text)

      if (!parsed.ok) {
        connectionStringError.value = t('connections.form.connectionString.invalid')
        return
      }

      Object.assign(connection.value, parsed.value)
    })

    const connectionStringSummary = computed(() => {
      if (!connectionString.value.trim() || connectionStringError.value) return []

      const value = connection.value

      return [
        { label: t('connections.new.fields.databaseType.label'), value: t(`database.types.${value.databaseType}`) },
        { label: t('connections.new.fields.host.label'), value: value.port ? `${value.host}:${value.port}` : value.host },
        { label: t('connections.new.fields.databaseName.label'), value: value.databaseName || '—' },
        { label: t('connections.new.fields.username.label'), value: value.username || '—' },
        { label: t('connections.new.fields.password.label'), value: value.password ? '••••••••' : '—' },
        { label: t('connections.new.fields.sslMode.label'), value: t(`database.sslModes.${value.sslMode}`) }
      ]
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
      connectionString,
      connectionStringError,
      connectionStringPlaceholder,
      connectionStringSummary,
      entryMode,
      entryModeItems,
      copied,
      copy,
      databaseTypeItems,
      readOnlyLoginSql,
      formTextPrefix,
      isSaving,
      isTesting,
      onCancel,
      onSave,
      onSubmit,
      screenAlert,
      sslModeItems,
      t
    }
  }
})

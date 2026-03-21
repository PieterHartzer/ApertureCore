<script lang="ts" setup>
import AppAlert from '~/components/ui/AppAlert.vue'
import { useDatabaseConnectionSave } from '~/composables/database/useDatabaseConnectionSave'
import { useDatabaseConnectionUpdate } from '~/composables/database/useDatabaseConnectionUpdate'
import { useDatabaseConnectionTest } from '~/composables/database/useDatabaseConnectionTest'
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

interface Props {
  mode?: 'create' | 'edit'
  connectionId?: string
  initialConnection?: DatabaseConnection | null
  hasStoredPassword?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  mode: 'create',
  connectionId: undefined,
  initialConnection: null,
  hasStoredPassword: false
})

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
</script>

<template>
  <UForm
    :state="connection"
    class="space-y-6"
    @submit="onSubmit"
  >
    <div class="grid gap-6 md:grid-cols-2">
      <UFormField
        name="connectionName"
        :label="t('connections.new.fields.connectionName.label')"
        :description="t('connections.new.fields.connectionName.description')"
      >
        <UInput
          v-model="connection.connectionName"
          :placeholder="t('connections.new.fields.connectionName.placeholder')"
          class="w-full"
        />
      </UFormField>

      <UFormField
        name="databaseType"
        :label="t('connections.new.fields.databaseType.label')"
      >
        <USelect
          v-model="connection.databaseType"
          :items="databaseTypeItems"
          class="w-full"
        />
      </UFormField>

      <UFormField
        name="host"
        :label="t('connections.new.fields.host.label')"
      >
        <UInput
          v-model="connection.host"
          :placeholder="t('connections.new.fields.host.placeholder')"
          class="w-full"
        />
      </UFormField>

      <UFormField
        name="port"
        :label="t('connections.new.fields.port.label')"
      >
        <UInputNumber
          v-model="connection.port"
          :placeholder="t('connections.new.fields.port.placeholder')"
          :min="1"
          class="w-full"
        />
      </UFormField>

      <UFormField
        name="databaseName"
        :label="t('connections.new.fields.databaseName.label')"
      >
        <UInput
          v-model="connection.databaseName"
          :placeholder="t('connections.new.fields.databaseName.placeholder')"
          class="w-full"
        />
      </UFormField>

      <UFormField
        name="username"
        :label="t('connections.new.fields.username.label')"
      >
        <UInput
          v-model="connection.username"
          :placeholder="t('connections.new.fields.username.placeholder')"
          class="w-full"
        />
      </UFormField>

      <UFormField
        name="password"
        :label="t('connections.new.fields.password.label')"
        :description="passwordDescription"
      >
        <UInput
          v-model="connection.password"
          type="password"
          :placeholder="t(`${formTextPrefix}.fields.password.placeholder`)"
          autocomplete="current-password"
          class="w-full"
        />
      </UFormField>

      <UFormField
        name="sslMode"
        :label="t('connections.new.fields.sslMode.label')"
      >
        <USelect
          v-model="connection.sslMode"
          :items="sslModeItems"
          class="w-full"
        />
      </UFormField>
    </div>

    <AppAlert
      v-if="screenAlert"
      :kind="screenAlert.kind"
      :title="screenAlert.title"
    >
      {{ screenAlert.message }}
    </AppAlert>

    <div class="flex gap-3">
      <UButton
        type="submit"
        icon="i-lucide-plug-zap"
        :label="isTesting ? t(`${formTextPrefix}.submit.loading`) : t(`${formTextPrefix}.submit.idle`)"
        :loading="isTesting"
        :disabled="isSaving"
      />

      <UButton
        type="button"
        icon="i-lucide-save"
        color="neutral"
        :label="isSaving ? t(`${formTextPrefix}.save.loading`) : t(`${formTextPrefix}.save.idle`)"
        :loading="isSaving"
        :disabled="!canSave"
        @click="onSave"
      />

      <UButton
        type="button"
        color="neutral"
        variant="ghost"
        icon="i-lucide-x"
        :label="t('connections.form.cancel')"
        :disabled="isTesting || isSaving"
        @click="onCancel"
      />
    </div>
  </UForm>
</template>

<script lang="ts" setup>
import AppAlert from '~/components/ui/AppAlert.vue'
import { useDatabaseConnectionSave } from '~/composables/database/useDatabaseConnectionSave'
import { useDatabaseConnectionTest } from '~/composables/database/useDatabaseConnectionTest'
import { useNotifications } from '~/composables/ui/useNotifications'
import {
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

const connection = ref(createEmptyDatabaseConnection())
const isTesting = ref(false)
const isSaving = ref(false)
const screenAlert = ref<ScreenAlert | null>(null)
const lastTestedConnectionSignature = ref<string | null>(null)
const lastSavedConnectionSignature = ref<string | null>(null)

const { saveConnection } = useDatabaseConnectionSave()
const { testConnection } = useDatabaseConnectionTest()
const { success } = useNotifications()
const { t } = useI18n()

const currentConnectionSignature = computed(() => {
  return JSON.stringify(connection.value)
})

const canSave = computed(() => {
  return (
    !isTesting.value &&
    !isSaving.value &&
    lastTestedConnectionSignature.value === currentConnectionSignature.value &&
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

watch(currentConnectionSignature, () => {
  clearScreenAlert()
})

const onSubmit = async () => {
  isTesting.value = true
  clearScreenAlert()
  lastTestedConnectionSignature.value = null

  try {
    const response = await testConnection(connection.value)
    const message = translateMessage(
      t,
      response.messageKey,
      response.ok
        ? 'connections.test.success'
        : 'connections.test.errors.unexpected'
    )

    if (response.ok) {
      lastTestedConnectionSignature.value = currentConnectionSignature.value
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
    const response = await saveConnection(connection.value)
    const message = translateMessage(
      t,
      response.messageKey,
      response.ok
        ? 'connections.save.success'
        : 'connections.save.errors.unexpected'
    )

    if (response.ok) {
      lastSavedConnectionSignature.value = currentConnectionSignature.value
      clearScreenAlert()
      success(message, t('connections.save.notifications.successTitle'))
      return
    }

    showScreenError(
      t('connections.save.notifications.errorTitle'),
      message
    )
  } finally {
    isSaving.value = false
  }
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
      >
        <UInput
          v-model="connection.password"
          type="password"
          :placeholder="t('connections.new.fields.password.placeholder')"
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
        :label="isTesting ? t('connections.new.submit.loading') : t('connections.new.submit.idle')"
        :loading="isTesting"
        :disabled="isSaving"
      />

      <UButton
        type="button"
        icon="i-lucide-save"
        color="neutral"
        :label="isSaving ? t('connections.new.save.loading') : t('connections.new.save.idle')"
        :loading="isSaving"
        :disabled="!canSave"
        @click="onSave"
      />
    </div>
  </UForm>
</template>

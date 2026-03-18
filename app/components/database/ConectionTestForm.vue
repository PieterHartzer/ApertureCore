<script lang="ts" setup>
import type { DatabaseConnectionTestResponse } from '~/types/database'

import ConnectionTestResult from '~/components/database/ConnectionTestResult.vue'
import { useDatabaseConnectionTest } from '~/composables/database/useDatabaseConnectionTest'
import { useNotifications } from '~/composables/ui/useNotifications'
import {
  createEmptyDatabaseConnection,
  DATABASE_SSL_MODES,
  DATABASE_TYPES
} from '~/types/database'
import { translateMessage } from '~/utils/translateMessage'

const connection = ref(createEmptyDatabaseConnection())
const isTesting = ref(false)
const result = ref<DatabaseConnectionTestResponse | null>(null)

const { testConnection } = useDatabaseConnectionTest()
const { success, error } = useNotifications()
const { t } = useI18n()

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

const onSubmit = async () => {
  isTesting.value = true
  result.value = null

  try {
    const response = await testConnection(connection.value)
    const message = translateMessage(t, response.messageKey, response.message)

    result.value = response

    if (response.ok) {
      success(message, t('connections.test.notifications.successTitle'))
      return
    }

    error(message, t('connections.test.notifications.errorTitle'))
  } finally {
    isTesting.value = false
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

    <ConnectionTestResult :result="result" />

    <UButton
      type="submit"
      icon="i-lucide-plug-zap"
      :label="isTesting ? t('connections.new.submit.loading') : t('connections.new.submit.idle')"
      :loading="isTesting"
    />
  </UForm>
</template>

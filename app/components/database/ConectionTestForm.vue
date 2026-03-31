<script>
import component from '~/view-models/components/database/ConectionTestForm'

export default component
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

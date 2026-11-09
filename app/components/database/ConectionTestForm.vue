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
    <section class="connection-section">
      <div>
        <h2 class="text-sm font-medium text-highlighted">{{ t('connections.form.sections.general.title') }}</h2>
        <p class="mt-0.5 text-xs leading-5 text-muted">{{ t('connections.form.sections.general.description') }}</p>
      </div>
      <div class="min-w-0 space-y-4">
        <div class="grid grid-cols-12 gap-4">
          <UFormField class="col-span-12 sm:col-span-8" name="connectionName" :label="t('connections.new.fields.connectionName.label')">
            <UInput v-model="connection.connectionName" :placeholder="t('connections.new.fields.connectionName.placeholder')" class="w-full" />
          </UFormField>
          <UFormField class="col-span-12 sm:col-span-4" name="databaseType" :label="t('connections.new.fields.databaseType.label')">
            <USelect v-model="connection.databaseType" :items="databaseTypeItems" class="w-full" />
          </UFormField>
        </div>
      </div>
    </section>

    <section class="connection-section">
      <div>
        <h2 class="text-sm font-medium text-highlighted">{{ t('connections.form.sections.server.title') }}</h2>
        <p class="mt-0.5 text-xs leading-5 text-muted">{{ t('connections.form.sections.server.description') }}</p>
      </div>
      <div class="min-w-0 space-y-4">
        <div class="grid grid-cols-12 gap-4">
          <UFormField class="col-span-8 lg:col-span-6" name="host" :label="t('connections.new.fields.host.label')">
            <UInput v-model="connection.host" :placeholder="t('connections.new.fields.host.placeholder')" class="w-full font-mono" />
          </UFormField>
          <UFormField class="col-span-4 lg:col-span-2" name="port" :label="t('connections.new.fields.port.label')">
            <UInputNumber
              v-model="connection.port"
              :placeholder="t('connections.new.fields.port.placeholder')"
              :min="1"
              :max="65535"
              :increment="false"
              :decrement="false"
              :format-options="{ useGrouping: false }"
              class="w-full"
              :ui="{ base: 'text-left font-mono' }"
            />
          </UFormField>
          <UFormField class="col-span-12 lg:col-span-4" name="sslMode" :label="t('connections.new.fields.sslMode.label')">
            <USelect v-model="connection.sslMode" :items="sslModeItems" class="w-full" />
          </UFormField>
        </div>
      </div>
    </section>

    <section class="connection-section">
      <div>
        <h2 class="text-sm font-medium text-highlighted">{{ t('connections.form.sections.login.title') }}</h2>
        <p class="mt-0.5 text-xs leading-5 text-muted">{{ t('connections.form.sections.login.description') }}</p>
      </div>
      <div class="min-w-0 space-y-4">
        <div class="grid grid-cols-12 gap-4">
          <UFormField class="col-span-12 lg:col-span-4" name="databaseName" :label="t('connections.new.fields.databaseName.label')">
            <UInput v-model="connection.databaseName" :placeholder="t('connections.new.fields.databaseName.placeholder')" class="w-full font-mono" />
          </UFormField>
          <UFormField class="col-span-12 sm:col-span-6 lg:col-span-4" name="username" :label="t('connections.new.fields.username.label')">
            <UInput v-model="connection.username" :placeholder="t('connections.new.fields.username.placeholder')" class="w-full font-mono" />
          </UFormField>
          <UFormField class="col-span-12 sm:col-span-6 lg:col-span-4" name="password" :label="t('connections.new.fields.password.label')">
            <UInput
              v-model="connection.password"
              type="password"
              :placeholder="t(`${formTextPrefix}.fields.password.placeholder`)"
              autocomplete="current-password"
              class="w-full"
            />
          </UFormField>
        </div>

        <details class="group rounded-lg border border-default bg-muted text-sm">
          <summary class="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 font-medium text-highlighted">
            <UIcon name="i-lucide-shield-check" class="size-4 text-primary" aria-hidden="true" />
            {{ t('connections.form.readOnly.title') }}
            <UIcon name="i-lucide-chevron-down" class="ml-auto size-4 text-muted transition-transform group-open:rotate-180" aria-hidden="true" />
          </summary>
          <div class="space-y-3 border-t border-default p-3">
            <p class="text-muted">{{ t('connections.form.readOnly.description') }}</p>
            <pre class="overflow-x-auto rounded-md border border-default bg-default p-3 font-mono text-xs text-default">{{ readOnlyLoginSql }}</pre>
            <UButton
              type="button"
              size="xs"
              color="neutral"
              variant="outline"
              :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'"
              :label="copied ? t('connections.form.readOnly.copied') : t('connections.form.readOnly.copy')"
              @click="copy(readOnlyLoginSql)"
            />
          </div>
        </details>
      </div>
    </section>

    <AppAlert
      v-if="screenAlert"
      :kind="screenAlert.kind"
      :title="screenAlert.title"
    >
      {{ screenAlert.message }}
    </AppAlert>

    <div class="flex flex-wrap items-center gap-2">
      <UButton
        type="submit"
        color="neutral"
        variant="outline"
        icon="i-lucide-plug-zap"
        :label="isTesting ? t(`${formTextPrefix}.submit.loading`) : t(`${formTextPrefix}.submit.idle`)"
        :loading="isTesting"
        :disabled="isSaving"
      />

      <UButton
        type="button"
        icon="i-lucide-save"
        :label="isSaving ? t(`${formTextPrefix}.save.loading`) : t(`${formTextPrefix}.save.idle`)"
        :loading="isSaving"
        :disabled="!canSave"
        @click="onSave"
      />

      <span v-if="!canSave && !isSaving" class="text-xs text-muted">{{ t('connections.form.testFirst') }}</span>

      <UButton
        class="ml-auto"
        type="button"
        color="neutral"
        variant="ghost"
        :label="t('connections.form.cancel')"
        :disabled="isTesting || isSaving"
        @click="onCancel"
      />
    </div>
  </UForm>
</template>

<style scoped>
.connection-section {
  display: grid;
  gap: 12px;
  padding-bottom: 24px;
  border-bottom: 1px solid var(--ui-border);
}

@media (min-width: 1024px) {
  .connection-section {
    grid-template-columns: 15rem minmax(0, 1fr);
    gap: 32px;
  }
}
</style>

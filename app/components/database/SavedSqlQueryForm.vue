<script>
import component from '~/view-models/components/database/SavedSqlQueryForm'

export default component
</script>

<template>
  <UForm
    :state="query"
    class="space-y-6"
    @submit="onSubmit"
  >
    <AppAlert
      v-if="errorMessage"
      kind="error"
      :title="errorTitle"
    >
      {{ errorMessage }}
    </AppAlert>

    <div class="grid gap-6">
      <UFormField
        name="queryName"
        :label="t('queries.form.fields.queryName.label')"
        :description="t('queries.form.fields.queryName.description')"
      >
        <UInput
          v-model="query.queryName"
          :placeholder="t('queries.form.fields.queryName.placeholder')"
          class="w-full"
        />
      </UFormField>

      <UFormField
        name="connectionId"
        :label="t('queries.form.fields.connectionId.label')"
        :description="t('queries.form.fields.connectionId.description')"
      >
        <USelect
          v-model="query.connectionId"
          :items="connections"
          :placeholder="t('queries.form.fields.connectionId.placeholder')"
          class="w-full"
        />
      </UFormField>

      <UFormField
        name="sql"
        :label="t('queries.form.fields.sql.label')"
        :description="t('queries.form.fields.sql.description')"
      >
        <UTextarea
          v-model="query.sql"
          :rows="14"
          :placeholder="t('queries.form.fields.sql.placeholder')"
          class="w-full font-mono"
        />
      </UFormField>
    </div>

    <div class="flex flex-wrap items-center gap-3">
      <UButton
        type="button"
        icon="i-lucide-play"
        :loading="isTesting"
        :disabled="!canTest"
        :label="isTesting ? testLoadingLabel : testLabel"
        @click="onTest"
      />
      <UButton
        type="submit"
        icon="i-lucide-save"
        :loading="isSubmitting"
        :disabled="!canSubmit"
        :label="isSubmitting ? submitLoadingLabel : submitLabel"
      />
      <UButton
        type="button"
        color="neutral"
        variant="soft"
        :disabled="isSubmitting || isTesting"
        :label="cancelLabel"
        @click="onCancel"
      />
    </div>

    <AppAlert
      v-if="testErrorMessage"
      kind="error"
      :title="t('queries.test.notifications.errorTitle')"
    >
      <div class="space-y-2">
        <p>{{ testErrorMessage }}</p>
        <p
          v-if="testErrorDetails"
          class="text-sm whitespace-pre-wrap break-words"
        >
          {{ t('queries.test.errors.details', { details: testErrorDetails }) }}
        </p>
      </div>
    </AppAlert>

    <div
      v-if="testResult"
      class="space-y-3"
    >
      <div class="space-y-1">
        <p class="font-medium">
          {{ t('queries.test.results.title') }}
        </p>
        <p class="text-sm text-muted">
          {{ resultsDescription }}
        </p>
      </div>

      <UTable
        :data="testResult.rows"
        :columns="resultColumns"
        :empty="t('queries.test.results.empty')"
      />
    </div>
  </UForm>
</template>

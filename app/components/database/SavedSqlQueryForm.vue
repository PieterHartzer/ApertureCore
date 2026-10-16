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
      :title="localizeAppMessage($t, errorTitle)"
    >
      {{ localizeAppMessage($t, errorMessage) }}
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

      <UPageCard
        v-if="query.connectionId"
        icon="i-lucide-sparkles"
        :title="t('queries.form.fields.aiSql.title')"
        :description="t('queries.form.fields.aiSql.description')"
      >
        <div class="space-y-4">
          <UButton to="/settings/ai-models" type="button" color="neutral" variant="soft" icon="i-lucide-settings-2" :label="$t('interface.manageAIProvidersAndModels')" />
          <UButton v-if="sessionExpired" to="/login?callbackRedirectUrl=/queries" target="_blank" rel="noopener" type="button" :label="$t('interface.signInAgainNewTab')" />
          <p v-if="checking" role="status" class="text-sm text-muted">{{ $t('interface.loadingYourAISettings') }}</p>
          <div v-else-if="!modelGroups.length" class="space-y-2 text-sm text-muted">
            <p>{{ $t('interface.noAIModelsConfiguredAddAnOpenAIOrLMStudio') }}</p>
            <UButton type="button" :label="$t('interface.refreshModels')" color="neutral" variant="ghost" @click="refreshModels" />
          </div>
          <template v-else>
            <UFormField :label="$t('interface.aiModel')" name="aiModel" :description="$t('interface.chooseAModelForThisQueryYourSavedDefaultStays')">
              <select id="saved-query-ai-model" v-model="selectedModel" :aria-label="$t('interface.aiModel')" :disabled="loading || generatingSql || isSubmitting || isTesting" class="w-full rounded-lg border border-default bg-default p-3">
                <option value="" disabled>{{ $t('interface.selectAConfiguredModel') }}</option>
                <optgroup v-for="group in modelGroups" :key="group.label" :label="localizeAppMessage($t, group.label)">
                  <option v-for="model in group.models" :key="model.id" :value="model.id">{{ model.displayName }}{{ model.isDefault ? $t('interface.default') : '' }}</option>
                </optgroup>
              </select>
            </UFormField>
            <p v-if="selectedConnection" class="text-sm text-muted">{{ $t('interface.aiConnection', { value1: selectedConnection.name, value2: selectedConnection.baseUrl }) }}</p>
            <AppAlert v-if="selected && selected.providerType !== 'webllm'" kind="warning" :title="localizeAppMessage($t, $t('interface.providerDataNotice'))">{{ $t('interface.yourQuestionAndSelectedDatabaseSchemaWillBeSentTo', { value1: selectedConnection?.name, value2: selectedConnection?.baseUrl }) }}</AppAlert>
            <UFormField v-if="selected?.providerType === 'lmstudio'" :label="$t('interface.lmStudioAPIKeyOptionalThisPageSessionOnly')" name="aiSessionKey">
              <UInput v-model="sessionApiKey" type="password" autocomplete="off" class="w-full" />
            </UFormField>
            <AppAlert v-if="selected?.providerType === 'webllm' && !supported" kind="warning" :title="t('queries.form.fields.aiSql.unsupported.title')">
              {{ $t('interface.chooseOpenAIOrLMStudioToUseAnotherProvider', { value1: t('queries.form.fields.aiSql.unsupported.description') }) }}</AppAlert>
            <p v-if="selected?.providerType === 'webllm' && !ready" class="text-sm text-muted">
              {{ selectedCached ? t('queries.form.fields.aiSql.ready.cached') : t('queries.form.fields.aiSql.ready.notCached') }}
            </p>
            <div class="flex flex-wrap gap-2 sm:gap-3">
              <UButton
                v-if="selected?.providerType === 'webllm' && !ready"
                :label="selectedCached ? t('queries.form.fields.aiSql.actions.loadCached') : t('queries.form.fields.aiSql.actions.download')"
                color="neutral"
                variant="outline"
                icon="i-lucide-download"
                :loading="loading"
                :disabled="loading || generatingSql || !supported"
                @click="loadModel"
              />
              <UButton
                v-if="loading"
                :label="t('queries.form.fields.aiSql.actions.cancel')"
                color="neutral"
                variant="ghost"
                @click="stopModel"
              />
              <UBadge
                v-if="ready"
                :label="selected?.providerType === 'webllm' ? t('queries.form.fields.aiSql.status.ready') : $t('interface.providerConfiguredVerifiedWhenGenerating')"
                color="success"
                variant="subtle"
              />
            </div>

            <div v-if="loading" class="space-y-2" :aria-busy="loading">
              <div class="flex justify-between gap-3 text-sm">
                <span>{{ t('queries.form.fields.aiSql.progress.label') }}</span>
                <span class="tabular-nums">{{ progress }}%</span>
              </div>
              <UProgress :model-value="progress" :max="100" :aria-label="t('queries.form.fields.aiSql.progress.label')" />
            </div>

            <p v-if="status" role="status" class="break-words text-sm text-muted">
              {{ localizeAppMessage($t, status) }}
            </p>

            <UFormField
              v-if="ready"
              :label="t('queries.form.fields.aiSql.question.label')"
              :description="t('queries.form.fields.aiSql.question.description')"
            >
              <UTextarea
                v-model="question"
                :placeholder="t('queries.form.fields.aiSql.question.placeholder')"
                :rows="3"
                :maxlength="2000"
                :disabled="generatingSql"
                class="w-full"
              />
            </UFormField>

            <UButton
              v-if="ready"
              :label="t('queries.form.fields.aiSql.actions.generate')"
              icon="i-lucide-sparkles"
              :loading="generatingSql"
              :disabled="!canGenerate"
              @click="generateSql"
            />
            <UButton v-if="generatingSql" type="button" :label="$t('interface.cancelGeneration')" color="neutral" variant="ghost" @click="stopModel" />
          </template>

          <AppAlert v-if="schemaError" kind="error" :title="$t('interface.couldNotGenerateSQL')">
            {{ localizeAppMessage($t, schemaError) }}
          </AppAlert>

          <AppAlert v-if="modelError" kind="error" :title="t('queries.form.fields.aiSql.error.title')">
            {{ localizeAppMessage($t, modelError) }}
          </AppAlert>
        </div>
      </UPageCard>

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
        <p>{{ localizeAppMessage($t, testErrorMessage) }}</p>
        <p
          v-if="testErrorDetails"
          class="text-sm whitespace-pre-wrap break-words"
        >
          {{ localizeAppMessage($t, t('queries.test.errors.details', { details: testErrorDetails })) }}
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

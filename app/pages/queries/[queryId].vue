<script>
import component from '~/view-models/pages/queries/[queryId]'

export default component
</script>

<template>
  <UPage>
    <UPageHeader
      :headline="t('queries.edit.headline')"
      :title="t('queries.edit.title')"
      :description="t('queries.edit.description')"
    >
      <template #links>
        <AppLocaleSelect />
      </template>
    </UPageHeader>

    <UPageBody>
      <AppAlert
        v-if="loadErrorMessage"
        kind="error"
        :title="t('queries.edit.errors.loadTitle')"
      >
        {{ loadErrorMessage }}
      </AppAlert>

      <UPageCard
        v-else-if="isLoading || !initialQuery"
        icon="i-lucide-loader-circle"
        :title="t('queries.edit.card.title')"
        :description="t('queries.edit.loading')"
      />

      <UPageCard
        v-else
        icon="i-lucide-pencil-line"
        :title="t('queries.edit.card.title')"
        :description="t('queries.edit.card.description')"
      >
        <SavedSqlQueryForm
          :key="queryId"
          mode="edit"
          :initial-query="initialQuery"
          :connections="connectionOptions"
          :is-submitting="isSaving"
          :submit-label="t('queries.edit.actions.save')"
          :submit-loading-label="t('queries.edit.actions.saveLoading')"
          :test-label="t('queries.edit.actions.test')"
          :test-loading-label="t('queries.edit.actions.testLoading')"
          :cancel-label="t('queries.edit.actions.cancel')"
          :error-title="t('queries.update.notifications.errorTitle')"
          :error-message="saveErrorMessage"
          @submit="onSubmit"
          @cancel="onCancel"
        />
      </UPageCard>
    </UPageBody>
  </UPage>
</template>

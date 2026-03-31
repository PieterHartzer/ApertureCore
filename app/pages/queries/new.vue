<script>
import component from '~/view-models/pages/queries/new'

export default component
</script>

<template>
  <UPage>
    <UPageHeader
      :headline="t('queries.new.headline')"
      :title="t('queries.new.title')"
      :description="t('queries.new.description')"
    >
      <template #links>
        <AppLocaleSelect />
      </template>
    </UPageHeader>

    <UPageBody>
      <AppAlert
        v-if="connectionsLoadErrorMessage"
        kind="error"
        :title="t('queries.new.errors.loadTitle')"
      >
        {{ connectionsLoadErrorMessage }}
      </AppAlert>

      <UPageCard
        v-else-if="isLoading"
        icon="i-lucide-loader-circle"
        :title="t('queries.new.card.title')"
        :description="t('queries.new.loading')"
      />

      <UPageCard
        v-else-if="connectionOptions.length === 0"
        icon="i-lucide-database"
        :title="t('queries.new.emptyConnections.title')"
        :description="t('queries.new.emptyConnections.description')"
      >
        <UButton
          to="/connections/new"
          icon="i-lucide-database-zap"
          :label="t('queries.new.emptyConnections.action')"
        />
      </UPageCard>

      <UPageCard
        v-else
        icon="i-lucide-file-plus-2"
        :title="t('queries.new.card.title')"
        :description="t('queries.new.card.description')"
      >
        <SavedSqlQueryForm
          mode="create"
          :connections="connectionOptions"
          :is-submitting="isSaving"
          :submit-label="t('queries.new.actions.save')"
          :submit-loading-label="t('queries.new.actions.saveLoading')"
          :test-label="t('queries.new.actions.test')"
          :test-loading-label="t('queries.new.actions.testLoading')"
          :cancel-label="t('queries.new.actions.cancel')"
          :error-title="t('queries.save.notifications.errorTitle')"
          :error-message="saveErrorMessage"
          @submit="onSubmit"
          @cancel="onCancel"
        />
      </UPageCard>
    </UPageBody>
  </UPage>
</template>

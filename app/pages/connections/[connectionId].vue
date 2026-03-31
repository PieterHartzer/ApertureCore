<script>
import component from '~/view-models/pages/connections/[connectionId]'

export default component
</script>

<template>
  <UPage>
    <UPageHeader
      :headline="t('connections.edit.headline')"
      :title="t('connections.edit.title')"
      :description="t('connections.edit.description')"
    >
      <template #links>
        <AppLocaleSelect />
      </template>
    </UPageHeader>

    <UPageBody>
      <AppAlert
        v-if="loadErrorMessage"
        kind="error"
        :title="t('connections.edit.errors.loadTitle')"
      >
        {{ loadErrorMessage }}
      </AppAlert>

      <UPageCard
        v-else-if="isLoading || !initialConnection"
        icon="i-lucide-loader-circle"
        :title="t('connections.edit.card.title')"
        :description="t('connections.edit.loading')"
      />

      <UPageCard
        v-else
        icon="i-lucide-pencil-line"
        :title="t('connections.edit.card.title')"
        :description="t('connections.edit.card.description')"
      >
        <ConectionTestForm
          :key="connectionId"
          mode="edit"
          :connection-id="connectionId"
          :initial-connection="initialConnection"
          :has-stored-password="hasStoredPassword"
        />
      </UPageCard>
    </UPageBody>
  </UPage>
</template>

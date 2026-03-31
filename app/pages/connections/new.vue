<script>
import component from '~/view-models/pages/connections/new'

export default component
</script>

<template>
  <UPage>
    <UPageHeader
      :headline="t('connections.new.headline')"
      :title="t('connections.new.title')"
      :description="t('connections.new.description')"
    >
      <template #links>
        <AppLocaleSelect />
      </template>
    </UPageHeader>

    <UPageBody>
      <UPageCard
        icon="i-lucide-database-zap"
        :title="t('connections.new.card.title')"
        :description="t('connections.new.card.description')"
      >
        <ConectionTestForm />
      </UPageCard>
    </UPageBody>
  </UPage>
</template>

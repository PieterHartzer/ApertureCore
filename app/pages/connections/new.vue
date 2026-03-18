<script setup lang="ts">
import AppLocaleSelect from '~/components/ui/AppLocaleSelect.vue'
import ConectionTestForm from '~/components/database/ConectionTestForm.vue'

const { t } = useI18n()
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

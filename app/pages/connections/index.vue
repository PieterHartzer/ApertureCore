<script setup lang="ts">
import AppLocaleSelect from '~/components/ui/AppLocaleSelect.vue'

const { t } = useI18n()
</script>

<template>
  <UPage>
    <UPageHeader
      :headline="t('connections.index.headline')"
      :title="t('connections.index.title')"
      :description="t('connections.index.description')"
    >
      <template #links>
        <div class="flex items-center gap-3">
          <AppLocaleSelect />
          <UButton
            to="/connections/new"
            icon="i-lucide-plus"
            :label="t('connections.index.actions.new')"
          />
        </div>
      </template>
    </UPageHeader>

    <UPageBody>
      <UPageCard
        icon="i-lucide-database"
        :title="t('connections.index.empty.title')"
        :description="t('connections.index.empty.description')"
      >
        <UButton
          to="/connections/new"
          icon="i-lucide-database-zap"
          :label="t('connections.index.actions.addFirst')"
        />
      </UPageCard>
    </UPageBody>
  </UPage>
</template>

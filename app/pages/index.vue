<script setup lang="ts">
import AppLocaleSelect from '~/components/ui/AppLocaleSelect.vue'

const { t } = useI18n()
</script>

<template>
  <UPage>
    <UPageHeader
      :headline="t('pages.dashboard.headline')"
      :title="t('pages.dashboard.title')"
      :description="t('pages.dashboard.description')"
    >
      <template #links>
        <AppLocaleSelect />
      </template>
    </UPageHeader>
  </UPage>
</template>

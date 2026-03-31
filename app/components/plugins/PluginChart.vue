<script>
import component from '~/view-models/components/plugins/PluginChart'

export default component
</script>

<template>
  <ClientOnly>
    <VChart
      autoresize
      :option="option"
      class="h-full min-h-0 w-full"
      :class="heightClass"
    />

    <template #fallback>
      <div
        class="flex h-full min-h-0 w-full items-center justify-center rounded-xl border border-dashed border-default px-6 py-12 text-sm text-muted"
        :class="heightClass"
      >
        {{ t('pages.dashboard.plugins.shared.loading') }}
      </div>
    </template>
  </ClientOnly>
</template>

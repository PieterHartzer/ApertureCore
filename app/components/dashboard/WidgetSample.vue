<script>
import component from '~/view-models/components/dashboard/WidgetSample'

export default component
</script>

<template>
  <div ref="root" class="relative h-full w-full min-w-0 overflow-hidden" data-widget-sample>
    <PluginRenderer
      v-if="isVisible && sample"
      :widget="{ pluginId, pluginConfig: config }"
      :columns="columns"
      :rows="sample.rows"
    />
    <div v-else class="h-full w-full animate-pulse rounded-md bg-elevated/60" aria-hidden="true" />
  </div>
</template>

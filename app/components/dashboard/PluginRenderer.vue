<script>
import component from '~/view-models/components/dashboard/PluginRenderer'

export default component
</script>

<template>
  <div
    v-bind="attrs"
    class="chart-container h-full min-h-0 w-full"
  >
    <AppAlert
      v-if="!plugin"
      kind="warning"
      class="error-state"
      :title="t('pages.dashboard.plugins.renderer.unknownTitle')"
    >
      {{ t('pages.dashboard.plugins.renderer.unknownDescription') }}
    </AppAlert>

    <AppAlert
      v-else-if="missingRequiredInputs.length > 0"
      kind="info"
      class="error-state"
      :title="t('pages.dashboard.plugins.renderer.incompleteTitle')"
    >
      {{ t('pages.dashboard.plugins.renderer.incompleteDescription') }}
    </AppAlert>

    <component
      :is="plugin.component"
      v-else
      :data="rows"
      :columns="columns"
      :config="widget.pluginConfig"
      class="plugin-renderer"
    />
  </div>
</template>

<style scoped>
.chart-container {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 200px;
}

.plugin-renderer {
  width: 100%;
  height: 100%;
}

/* Chart Loading State */
.plugin-renderer:deep(.loading) {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 200px;
}

.plugin-renderer:deep(.loading-skeleton) {
  width: 100%;
  height: 100%;
}

/* Chart Error State */
.plugin-renderer:deep(.error) {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  color: var(--color-destructive);
}

/* Chart Success State */
.plugin-renderer:deep(.success) {
  width: 100%;
  height: 100%;
}

/* Responsive Chart Containers */
@media (max-width: 640px) {
  .chart-container {
    min-height: 150px;
  }
}

@media (min-width: 768px) {
  .chart-container {
    min-height: 200px;
  }
}

@media (min-width: 1024px) {
  .chart-container {
    min-height: 250px;
  }
}
</style>

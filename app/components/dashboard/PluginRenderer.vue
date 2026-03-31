<script>
import component from '~/view-models/components/dashboard/PluginRenderer'

export default component
</script>

<template>
  <div
    v-bind="attrs"
    class="h-full min-h-0 w-full"
  >
    <AppAlert
      v-if="!plugin"
      kind="warning"
      :title="t('pages.dashboard.plugins.renderer.unknownTitle')"
    >
      {{ t('pages.dashboard.plugins.renderer.unknownDescription') }}
    </AppAlert>

    <AppAlert
      v-else-if="missingRequiredInputs.length > 0"
      kind="info"
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
    />
  </div>
</template>

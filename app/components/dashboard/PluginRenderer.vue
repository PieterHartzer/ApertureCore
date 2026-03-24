<script setup lang="ts">
import AppAlert from '~/components/ui/AppAlert.vue'
import { useUIPlugins } from '~/composables/useUIPlugins'
import type { DashboardWidget } from '~/types/dashboard-widgets'
import type { SavedSqlQueryResultRow } from '~/types/saved-sql-queries'

const { t } = useI18n()

const props = withDefaults(defineProps<{
  widget: Pick<DashboardWidget, 'pluginId' | 'pluginConfig'>
  columns?: string[]
  rows?: SavedSqlQueryResultRow[]
}>(), {
  columns: () => [],
  rows: () => []
})

const { getPlugin } = useUIPlugins()

const plugin = computed(() => {
  return getPlugin(props.widget.pluginId)
})

const missingRequiredInputs = computed(() => {
  if (!plugin.value) {
    return []
  }

  return plugin.value.inputSchema.filter((input) => {
    if (!input.required) {
      return false
    }

    const value = props.widget.pluginConfig[input.key]

    return typeof value !== 'string' || value.trim().length === 0
  })
})
</script>

<template>
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
</template>

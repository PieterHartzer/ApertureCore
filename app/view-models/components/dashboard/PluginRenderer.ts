import { computed, defineComponent, useAttrs, type PropType } from 'vue'

import AppAlert from '~/components/ui/AppAlert.vue'
import { useUIPlugins } from '~/composables/useUIPlugins'
import type { DashboardWidget } from '~/types/dashboard-widgets'
import type { SavedSqlQueryResultRow } from '~/types/saved-sql-queries'
import { getUIPluginInputSelectionMode } from '~/types/uiPlugin'
import { applyLabelOverridesToRows } from '~/utils/charts/chart-settings'
import { applyColumnFormatsToRows } from '~/utils/charts/column-formats'

export default defineComponent({
  components: {
    AppAlert
  },
  inheritAttrs: false,
  props: {
    widget: {
      type: Object as PropType<Pick<DashboardWidget, 'pluginId' | 'pluginConfig'>>,
      required: true
    },
    columns: {
      type: Array as PropType<string[]>,
      default: () => []
    },
    rows: {
      type: Array as PropType<SavedSqlQueryResultRow[]>,
      default: () => []
    }
  },
  setup(props) {
    const { t, locale } = useI18n()
    const attrs = useAttrs()
    const { getPlugin } = useUIPlugins()

    const plugin = computed(() => {
      return getPlugin(props.widget.pluginId)
    })

    // Columns a chart reads as real dates (a time axis, a calendar) keep their raw value.
    const keepAsDates = computed(() => new Set((plugin.value?.inputSchema ?? [])
      .filter(input => input.compatibleFieldTypes?.length === 1 && input.compatibleFieldTypes[0] === 'date')
      .flatMap((input) => {
        const value = props.widget.pluginConfig[input.key]

        return Array.isArray(value) ? value.map(String) : typeof value === 'string' && value ? [value] : []
      })))

    const displayRows = computed(() => applyColumnFormatsToRows(
      applyLabelOverridesToRows(props.rows, props.widget.pluginConfig),
      props.widget.pluginConfig,
      String(locale.value) === 'pseudo' ? 'en' : locale.value,
      keepAsDates.value
    ))

    const missingRequiredInputs = computed(() => {
      if (!plugin.value) {
        return []
      }

      return plugin.value.inputSchema.filter((input) => {
        if (!input.required) {
          return false
        }

        const value = props.widget.pluginConfig[input.key]

        if (getUIPluginInputSelectionMode(input) === 'multiple') {
          return !Array.isArray(value) || value.length === 0
        }

        return typeof value === 'string'
          ? value.trim().length === 0
          : typeof value !== 'number' && typeof value !== 'boolean'
      })
    })

    return {
      attrs,
      displayRows,
      missingRequiredInputs,
      plugin,
      t
    }
  }
})

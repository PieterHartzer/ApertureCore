import { computed, defineComponent, useAttrs, type PropType } from 'vue'

import AppAlert from '~/components/ui/AppAlert.vue'
import { useUIPlugins } from '~/composables/useUIPlugins'
import type { DashboardWidget } from '~/types/dashboard-widgets'
import type { SavedSqlQueryResultRow } from '~/types/saved-sql-queries'
import { getUIPluginInputSelectionMode } from '~/types/uiPlugin'

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
    const { t } = useI18n()
    const attrs = useAttrs()
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
      missingRequiredInputs,
      plugin,
      t
    }
  }
})

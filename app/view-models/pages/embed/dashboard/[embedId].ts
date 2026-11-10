import ExtensionSlot from '~/components/ui/ExtensionSlot.vue'
import { computed, defineComponent, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import WidgetGrid from '~/components/dashboard/WidgetGrid.vue'
import PluginRenderer from '~/components/dashboard/PluginRenderer.vue'
import WidgetSkeleton from '~/components/dashboard/WidgetSkeleton.vue'
import AppAlert from '~/components/ui/AppAlert.vue'
import { getCardStyle } from '~/utils/charts/chart-settings'
import { useEmbeddedDashboard } from '~/composables/dashboard/useEmbeddedDashboard'
import { useEmbeddedDashboardQueryResults } from '~/composables/dashboard/useEmbeddedDashboardQueryResults'
import type { EmbeddedDashboardWidget } from '~/types/dashboards'
import { useUIPlugins } from '~/composables/useUIPlugins'
import { provideDashboardChartStyle } from '~/composables/useDashboardChartStyle'
import { buildDashboardCss, getDashboardChartStyle } from '#shared/utils/dashboard-style'
import { removeWidgetTypeFromTitle } from '~/types/dashboard-widgets'
import { translateMessage } from '~/utils/translateMessage'

const DASHBOARD_REFRESH_TICK_MS = 5000

export default defineComponent({
  components: {
    ExtensionSlot,
    WidgetSkeleton,
    AppAlert,
    PluginRenderer,
    WidgetGrid
  },
  async setup() {
    // useHead must run before the first await in this setup.
    const appearance = ref('default')
    const savedStyle = ref<unknown>({})

    provideDashboardChartStyle(computed(() => getDashboardChartStyle(savedStyle.value)))

    useHead({
      htmlAttrs: { 'data-appearance': appearance },
      style: computed(() => [{ key: 'dashboard-style', textContent: buildDashboardCss(savedStyle.value) }])
    })

    const { t } = useI18n()
    const route = useRoute()
    const requestFetch = import.meta.server
      ? useRequestFetch()
      : $fetch
    const { getDashboard } = useEmbeddedDashboard(requestFetch)
    const queryResults = useEmbeddedDashboardQueryResults()
    const embedId = computed(() => {
      return typeof route.params.embedId === 'string'
        ? route.params.embedId
        : ''
    })

    let refreshTimer: ReturnType<typeof setInterval> | null = null

    // Lifecycle hooks must be registered before the first await in this setup.
    onMounted(() => {
      refreshTimer = setInterval(() => {
        void refreshWidgets()
      }, DASHBOARD_REFRESH_TICK_MS)
    })

    onBeforeUnmount(() => {
      if (refreshTimer) {
        clearInterval(refreshTimer)
      }
    })

    const { data: dashboardResponse, status } = await useAsyncData(
      () => `embedded-dashboard:${embedId.value}`,
      () => getDashboard(embedId.value),
      {
        watch: [embedId]
      }
    )

    const dashboard = computed(() => {
      return dashboardResponse.value?.ok
        ? dashboardResponse.value.dashboard ?? null
        : null
    })

    watch(dashboard, (value) => {
      appearance.value = value?.appearance ?? 'default'
      savedStyle.value = value?.style ?? {}
    }, { immediate: true })

    const loadErrorMessage = computed(() => {
      if (!dashboardResponse.value || dashboardResponse.value.ok) {
        return ''
      }

      return translateMessage(
        t,
        dashboardResponse.value.messageKey,
        'dashboards.embed.get.errors.unexpected'
      )
    })

    const widgetTargets = computed(() => {
      if (!dashboard.value) {
        return []
      }

      return dashboard.value.widgets.map((widget) => ({
        embedId: dashboard.value?.embedId ?? '',
        widgetId: widget.id,
        refreshIntervalMs: widget.refreshIntervalSeconds * 1000
      }))
    })

    const gridWidgets = computed(() => {
      if (!dashboard.value) {
        return []
      }

      return dashboard.value.widgets.map((widget) => ({
        ...widget,
        dashboardId: dashboard.value?.embedId ?? '',
        queryId: ''
      }))
    })

    const { getPlugin } = useUIPlugins()

    const getWidgetTitle = (widget: EmbeddedDashboardWidget) => {
      const plugin = getPlugin(widget.pluginId)
      const names = plugin ? [plugin.nameKey ? t(plugin.nameKey) : plugin.name, plugin.name] : []

      return removeWidgetTypeFromTitle(widget.title, names) || t('pages.dashboard.widgets.card.fallbackTitle')
    }

    const getWidgetState = (widget: EmbeddedDashboardWidget) => {
      if (!dashboard.value) {
        return null
      }

      return queryResults.getState({
        embedId: dashboard.value.embedId,
        widgetId: widget.id,
        refreshIntervalMs: widget.refreshIntervalSeconds * 1000
      })
    }

    const getWidgetErrorMessage = (widget: EmbeddedDashboardWidget) => {
      const state = getWidgetState(widget)

      if (!state?.errorMessage) {
        return ''
      }

      return translateMessage(
        t,
        state.errorMessageKey,
        'dashboards.embed.run.errors.unexpected'
      )
    }

    const isWidgetRefreshing = (widget: EmbeddedDashboardWidget) => {
      const state = getWidgetState(widget)

      return state?.status === 'success' && state.isRefreshing === true
    }

    const getWidgetInlineErrorMessage = (widget: EmbeddedDashboardWidget) => {
      const state = getWidgetState(widget)

      if (!state?.errorMessage || state.status !== 'success') {
        return ''
      }

      return getWidgetErrorMessage(widget)
    }

    const refreshWidgets = async (force = false) => {
      if (widgetTargets.value.length === 0) {
        return
      }

      if (force) {
        await Promise.all(
          widgetTargets.value.map((target) => queryResults.load(target, {
            force: true
          }))
        )
        return
      }

      await queryResults.refreshStale(widgetTargets.value)
    }

    watch(
      () => widgetTargets.value.map((target) => {
        return `${target.widgetId}:${target.refreshIntervalMs ?? ''}`
      }).join('|'),
      async () => {
        await refreshWidgets()
      },
      {
        immediate: true
      }
    )

    return {
      getCardStyle,
      getWidgetTitle,
      dashboard,
      getWidgetErrorMessage,
      getWidgetInlineErrorMessage,
      getWidgetState,
      gridWidgets,
      isWidgetRefreshing,
      loadErrorMessage,
      status,
      t
    }
  }
})

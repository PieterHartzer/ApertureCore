<script setup lang="ts">
import WidgetGrid from '~/components/dashboard/WidgetGrid.vue'
import PluginRenderer from '~/components/dashboard/PluginRenderer.vue'
import AppAlert from '~/components/ui/AppAlert.vue'
import { useEmbeddedDashboard } from '~/composables/dashboard/useEmbeddedDashboard'
import { useEmbeddedDashboardQueryResults } from '~/composables/dashboard/useEmbeddedDashboardQueryResults'
import type { EmbeddedDashboardWidget } from '~/types/dashboards'
import { translateMessage } from '~/utils/translateMessage'

definePageMeta({
  public: true
})

const DASHBOARD_REFRESH_TICK_MS = 5000

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
</script>

<template>
  <div class="min-h-screen bg-default px-4 py-4 sm:px-6 sm:py-6">
    <div class="space-y-4">
      <AppAlert
        v-if="loadErrorMessage"
        kind="error"
        :title="t('pages.dashboard.embed.errorTitle')"
      >
        {{ loadErrorMessage }}
      </AppAlert>

      <div
        v-else-if="status === 'pending'"
        class="flex min-h-[16rem] items-center justify-center rounded-2xl border border-dashed border-default px-6 py-10 text-sm text-muted"
      >
        {{ t('pages.dashboard.embed.loading') }}
      </div>

      <div
        v-else-if="!dashboard"
        class="flex min-h-[16rem] items-center justify-center rounded-2xl border border-dashed border-default px-6 py-10 text-sm text-muted"
      >
        {{ t('pages.dashboard.embed.empty') }}
      </div>

      <WidgetGrid
        v-else-if="gridWidgets.length > 0"
        :editable="false"
        :widgets="gridWidgets"
      >
        <template #item="{ widget }">
          <UCard
            class="h-full w-full"
            :ui="{
              root: 'flex h-full min-h-0 w-full flex-col overflow-hidden',
              header: 'flex-none p-4 sm:px-6 sm:py-4',
              body: 'flex min-h-0 flex-1 flex-col p-4 sm:p-6'
            }"
          >
            <template #header>
              <h2 class="truncate font-semibold text-highlighted">
                {{ widget.title || t('pages.dashboard.widgets.card.fallbackTitle') }}
              </h2>
            </template>

            <div class="flex h-full min-h-0 flex-col gap-4">
              <AppAlert
                v-if="getWidgetState(widget)?.status === 'pending'"
                kind="info"
                :title="t('pages.dashboard.widgets.card.loadingTitle')"
              >
                {{ t('pages.dashboard.widgets.card.loadingDescription') }}
              </AppAlert>

              <AppAlert
                v-else-if="getWidgetState(widget)?.status === 'error'"
                kind="error"
                :title="t('pages.dashboard.widgets.card.errorTitle')"
              >
                {{ getWidgetErrorMessage(widget) }}
              </AppAlert>

              <div
                v-else
                class="relative min-h-0 flex-1"
              >
                <div
                  v-if="isWidgetRefreshing(widget) || getWidgetInlineErrorMessage(widget)"
                  class="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-end p-3"
                >
                  <div
                    class="max-w-full rounded-lg border px-3 py-2 text-xs shadow-sm backdrop-blur"
                    :class="isWidgetRefreshing(widget)
                      ? 'border-default bg-default/90 text-muted'
                      : 'border-error/30 bg-error/10 text-error'"
                  >
                    <div
                      v-if="isWidgetRefreshing(widget)"
                      class="flex items-center gap-2 font-medium uppercase tracking-[0.18em]"
                    >
                      <UIcon
                        name="i-lucide-loader-circle"
                        class="size-3.5 animate-spin"
                      />
                      <span>{{ t('pages.dashboard.widgets.card.refreshing') }}</span>
                    </div>

                    <div
                      v-else
                      class="flex items-start gap-2"
                    >
                      <UIcon
                        name="i-lucide-triangle-alert"
                        class="mt-0.5 size-4 shrink-0"
                      />
                      <span>{{ getWidgetInlineErrorMessage(widget) }}</span>
                    </div>
                  </div>
                </div>

                <PluginRenderer
                  class="h-full min-h-0"
                  :widget="widget"
                  :columns="getWidgetState(widget)?.columns ?? []"
                  :rows="getWidgetState(widget)?.rows ?? []"
                />
              </div>
            </div>
          </UCard>
        </template>
      </WidgetGrid>

      <div
        v-else
        class="flex min-h-[16rem] items-center justify-center rounded-2xl border border-dashed border-default px-6 py-10 text-sm text-muted"
      >
        {{ t('pages.dashboard.widgets.empty.description') }}
      </div>
    </div>
  </div>
</template>

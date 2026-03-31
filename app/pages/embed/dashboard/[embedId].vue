<script>
import component from '~/view-models/pages/embed/dashboard/[embedId]'

definePageMeta({
  public: true
})

export default component
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

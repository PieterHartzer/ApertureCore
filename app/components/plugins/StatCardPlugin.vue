<script>
import component from '~/view-models/components/plugins/StatCardPlugin'

export default component
</script>

<template>
  <div
    v-if="!valueField"
    class="flex h-full min-h-0 items-center justify-center rounded-xl border border-dashed border-default px-6 py-10 text-sm text-muted"
  >
    {{ t('pages.dashboard.plugins.stat-card.emptyMapping') }}
  </div>

  <div
    v-else-if="!firstRow"
    class="flex h-full min-h-0 items-center justify-center rounded-xl border border-dashed border-default px-6 py-10 text-sm text-muted"
  >
    {{ t('pages.dashboard.plugins.stat-card.emptyRows') }}
  </div>

  <div
    v-else
    class="flex h-full min-h-0 flex-col rounded-2xl border border-default bg-gradient-to-br from-elevated to-muted/20 p-6"
  >
    <p class="text-sm font-medium uppercase tracking-[0.18em] text-muted">
      {{ supportingLabel || valueField }}
    </p>
    <p class="mt-4 text-4xl font-semibold text-highlighted">
      {{ formattedValue }}
    </p>
    <p class="mt-auto pt-3 text-sm text-muted">
      {{ t('pages.dashboard.plugins.stat-card.firstRowHint') }}
    </p>
  </div>
</template>

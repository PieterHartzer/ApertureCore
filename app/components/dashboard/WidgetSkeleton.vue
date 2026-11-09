<script>
import component from '~/view-models/components/dashboard/WidgetSkeleton'

export default component
</script>

<template>
  <div
    role="status"
    :aria-label="t('pages.dashboard.widgets.card.loadingTitle')"
    class="h-full min-h-0 w-full overflow-hidden"
  >
    <div
      v-if="kind === 'stat'"
      class="flex h-full flex-col justify-center gap-2"
    >
      <USkeleton class="h-8 w-32 max-w-full" />
      <USkeleton class="h-3.5 w-24 max-w-full" />
    </div>

    <div
      v-else-if="kind === 'table'"
      class="flex h-full flex-col gap-3 pt-1"
    >
      <USkeleton
        v-for="row in 12"
        :key="row"
        class="h-4 w-full shrink-0"
      />
    </div>

    <svg
      v-else-if="kind === 'line'"
      viewBox="0 0 100 40"
      preserveAspectRatio="none"
      aria-hidden="true"
      class="h-full w-full animate-pulse"
    >
      <path
        d="M0 30 L14 22 L28 26 L42 12 L56 18 L70 8 L84 16 L100 6"
        fill="none"
        stroke-width="2"
        stroke-linejoin="round"
        vector-effect="non-scaling-stroke"
        style="stroke: var(--ui-bg-accented)"
      />
    </svg>

    <div
      v-else
      class="flex h-full items-end justify-around gap-3 pb-6"
    >
      <USkeleton
        v-for="(height, index) in barHeights"
        :key="index"
        class="max-w-10 flex-1 rounded-b-none"
        :style="{ height: `${height}%` }"
      />
    </div>
  </div>
</template>

<script>
import component from '~/view-models/components/plugins/StatCardPlugin'

export default component
</script>

<template>
  <div
    v-if="!valueField"
    class="plugin-no-data"
  >
    <span class="plugin-no-data-label">{{ t('pages.dashboard.plugins.stat-card.emptyMapping') }}</span>
  </div>

  <div
    v-else-if="!firstRow"
    class="plugin-no-data"
  >
    <span class="plugin-no-data-label">{{ t('pages.dashboard.plugins.stat-card.emptyRows') }}</span>
  </div>

  <div
    v-else
    class="flex h-full min-h-0 flex-col justify-center"
    :style="textStyles.container"
  >
    <p data-widget-value class="flex items-center gap-2 text-[28px] font-semibold leading-tight tracking-tight text-highlighted" :style="textStyles.value">
      <span v-if="band" class="size-2.5 shrink-0 rounded-full" :style="{ backgroundColor: band.color }" aria-hidden="true" />
      {{ formattedValue }}
    </p>
    <p
      v-if="supportingLabel"
      data-widget-label
      :style="textStyles.label"
      class="mt-1 text-[13px] text-muted"
    >
      {{ supportingLabel }}
    </p>
  </div>
</template>

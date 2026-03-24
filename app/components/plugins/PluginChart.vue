<script setup lang="ts">
import type { EChartsOption } from 'echarts'

import { BarChart, LineChart } from 'echarts/charts'
import {
  GridComponent,
  LegendComponent,
  TitleComponent,
  TooltipComponent
} from 'echarts/components'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import VChart from 'vue-echarts'

use([
  BarChart,
  CanvasRenderer,
  GridComponent,
  LegendComponent,
  LineChart,
  TitleComponent,
  TooltipComponent
])

const { t } = useI18n()

withDefaults(defineProps<{
  option: EChartsOption
  heightClass?: string
}>(), {
  heightClass: 'min-h-[320px]'
})
</script>

<template>
  <ClientOnly>
    <VChart
      autoresize
      :option="option"
      class="w-full"
      :class="heightClass"
    />

    <template #fallback>
      <div
        class="flex w-full items-center justify-center rounded-xl border border-dashed border-default px-6 py-12 text-sm text-muted"
        :class="heightClass"
      >
        {{ t('pages.dashboard.plugins.shared.loading') }}
      </div>
    </template>
  </ClientOnly>
</template>

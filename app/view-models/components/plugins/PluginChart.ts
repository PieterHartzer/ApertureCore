import { defineComponent, type PropType } from 'vue'
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

export default defineComponent({
  components: {
    VChart
  },
  props: {
    option: {
      type: Object as PropType<EChartsOption>,
      required: true
    },
    heightClass: {
      type: String,
      default: 'h-full min-h-0'
    }
  },
  setup() {
    const { t } = useI18n()

    return {
      t
    }
  }
})

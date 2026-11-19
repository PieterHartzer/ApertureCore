import { defineComponent, type PropType } from 'vue'
import type { EChartsOption } from 'echarts'
import VChart from 'vue-echarts'

import '~/utils/charts/register-echarts'

// ECharts 6 throws while laying out a Sankey (and other roaming charts) at zero width or
// height, which happens for a moment while the grid reflows. One pixel is never seen.
const MIN_CHART_SIZE = { minWidth: '1px', minHeight: '1px' }

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
    },
    // Redraws from scratch, so settings from a previous mapping cannot linger.
    replace: {
      type: Boolean,
      default: false
    }
  },
  setup() {
    const { t } = useI18n()

    return {
      MIN_CHART_SIZE,
      t
    }
  }
})

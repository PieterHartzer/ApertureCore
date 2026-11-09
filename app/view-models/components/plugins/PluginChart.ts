import { defineComponent, type PropType } from 'vue'
import type { EChartsOption } from 'echarts'
import VChart from 'vue-echarts'

import '~/utils/charts/register-echarts'

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
      t
    }
  }
})

import { computed, defineComponent } from 'vue'

const BAR_HEIGHTS = [72, 48, 88, 36, 60, 44]

export default defineComponent({
  props: {
    pluginId: {
      type: String,
      default: ''
    }
  },
  setup(props) {
    const { t } = useI18n()

    const kind = computed(() => {
      switch (props.pluginId) {
        case 'stat-card':
          return 'stat'
        case 'table':
          return 'table'
        case 'line-chart':
          return 'line'
        default:
          return 'bar'
      }
    })

    return {
      barHeights: BAR_HEIGHTS,
      kind,
      t
    }
  }
})

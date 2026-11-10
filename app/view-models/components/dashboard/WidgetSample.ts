import { computed, defineComponent, onBeforeUnmount, onMounted, ref, type PropType } from 'vue'

import PluginRenderer from '~/components/dashboard/PluginRenderer.vue'
import type { UIPluginSample } from '~/types/uiPlugin'

/** Draws a widget from its sample rows, only once it scrolls into view. */
export default defineComponent({
  components: {
    PluginRenderer
  },
  props: {
    pluginId: {
      type: String,
      required: true
    },
    sample: {
      type: Object as PropType<UIPluginSample | undefined>,
      default: undefined
    },
    eager: {
      type: Boolean,
      default: false
    },
    // Small thumbnails leave out legends so the chart itself stays readable.
    minimal: {
      type: Boolean,
      default: false
    }
  },
  setup(props) {
    const root = ref<HTMLElement | null>(null)
    const isVisible = ref(props.eager)
    let observer: IntersectionObserver | null = null

    onMounted(() => {
      if (isVisible.value || !root.value || typeof IntersectionObserver === 'undefined') {
        isVisible.value = true
        return
      }

      observer = new IntersectionObserver((entries) => {
        if (entries.some(entry => entry.isIntersecting)) {
          isVisible.value = true
          observer?.disconnect()
        }
      }, { rootMargin: '200px' })
      observer.observe(root.value)
    })

    onBeforeUnmount(() => observer?.disconnect())

    const columns = computed(() => Object.keys(props.sample?.rows[0] ?? {}))
    const config = computed(() => props.minimal
      ? { ...props.sample?.config, advancedOptions: JSON.stringify({ legend: { show: false } }) }
      : props.sample?.config ?? {})

    return {
      columns,
      config,
      isVisible,
      root
    }
  }
})

import { computed, defineComponent, type PropType } from 'vue'

import { appExtensions } from '~/extensions'

export default defineComponent({
  props: {
    name: {
      type: String,
      required: true
    },
    slotProps: {
      type: Object as PropType<Record<string, unknown>>,
      default: () => ({})
    }
  },
  setup(props) {
    const components = computed(() => appExtensions.slots[props.name] ?? [])

    return {
      components
    }
  }
})

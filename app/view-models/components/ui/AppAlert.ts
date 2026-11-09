import { computed, defineComponent, type PropType } from 'vue'

import { FEEDBACK_THEME, type FeedbackKind } from '~/theme/feedback'

export default defineComponent({
  props: {
    kind: {
      type: String as PropType<FeedbackKind>,
      default: 'info'
    },
    title: {
      type: String,
      default: undefined
    },
    hasClose: {
      type: Boolean,
      default: false
    }
  },
  emits: ['close'],
  setup(props) {
    const tone = computed(() => {
      return FEEDBACK_THEME[props.kind]
    })

    return {
      tone
    }
  }
})

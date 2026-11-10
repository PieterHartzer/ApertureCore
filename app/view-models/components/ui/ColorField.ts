import { computed, defineComponent, useId, type PropType } from 'vue'

import { isHexColor, joinHexColor, splitHexColor } from '#shared/utils/color'

/** A colour picker with an opacity percentage, saved as #rrggbb or #rrggbbaa. */
export default defineComponent({
  props: {
    modelValue: {
      type: String as PropType<string | null>,
      default: null
    },
    label: {
      type: String,
      required: true
    },
    placeholder: {
      type: String,
      default: ''
    },
    // The colour picker starts here when nothing is chosen yet.
    fallback: {
      type: String,
      default: '#808080'
    },
    clearable: {
      type: Boolean,
      default: true
    }
  },
  emits: {
    'update:modelValue': (value: string | null) => value === null || isHexColor(value)
  },
  setup(props, { emit }) {
    const { t } = useI18n()
    const parts = computed(() => splitHexColor(isHexColor(props.modelValue) ? props.modelValue : props.fallback))
    const solid = computed(() => parts.value.solid)
    const opacity = computed(() => parts.value.opacity)

    const onSolidInput = (event: Event) => {
      const value = (event.target as HTMLInputElement).value

      // A first pick starts fully opaque; later picks keep the chosen opacity.
      emit('update:modelValue', joinHexColor(value, props.modelValue ? opacity.value : 100))
    }

    const sliderLabelId = useId()

    const onOpacityInput = (value: number | number[] | undefined) => {
      const number = Array.isArray(value) ? value[0] : value

      if (!props.modelValue || number === undefined) {
        return
      }

      emit('update:modelValue', joinHexColor(solid.value, number))
    }

    return {
      onOpacityInput,
      onSolidInput,
      opacity,
      sliderLabelId,
      solid,
      t
    }
  }
})

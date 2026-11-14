import { computed, defineComponent, ref, useId, watch, type PropType } from 'vue'

import { isHexColor, joinHexColor, splitHexColor } from '#shared/utils/color'

/** Reads typed or pasted HTML colours: #8b5cf6, 8b5cf6, #abc and #8b5cf680. */
export const parseHexInput = (input: string): string | null => {
  const text = input.trim().replace(/^#?/, '#').toLowerCase()
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(text)
  const full = short ? `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}` : text

  return isHexColor(full) ? full : null
}

/** A colour picker with a hex box and an opacity percentage, saved as #rrggbb or #rrggbbaa. */
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

    // The hex box: valid colours apply as you type; anything else waits and shows red.
    const draft = ref(props.modelValue ?? '')
    const draftInvalid = ref(false)

    watch(() => props.modelValue, (value) => {
      if (parseHexInput(draft.value) !== value) draft.value = value ?? ''
      draftInvalid.value = false
    })

    const onHexInput = (value: string | number) => {
      const text = String(value ?? '')
      const parsed = parseHexInput(text)

      draft.value = text

      if (!text.trim()) {
        draftInvalid.value = false
        if (props.clearable) emit('update:modelValue', null)
        return
      }

      draftInvalid.value = parsed === null

      if (!parsed) return

      // Six digits keep the chosen opacity; eight digits bring their own.
      emit('update:modelValue', parsed.length === 9 ? parsed : joinHexColor(parsed, props.modelValue ? opacity.value : 100))
    }

    const onHexBlur = () => {
      draft.value = props.modelValue ?? ''
      draftInvalid.value = false
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
      draft,
      draftInvalid,
      onHexBlur,
      onHexInput,
      onOpacityInput,
      onSolidInput,
      opacity,
      sliderLabelId,
      solid,
      t
    }
  }
})

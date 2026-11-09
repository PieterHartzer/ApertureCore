import ExtensionSlot from '~/components/ui/ExtensionSlot.vue'
import { appExtensions } from '~/extensions'
import { computed, defineComponent, type PropType } from 'vue'

import { DASHBOARD_STYLE_FIELDS, DASHBOARD_STYLE_GROUPS, type DashboardStyle, type DashboardStyleField } from '#shared/utils/dashboard-style-fields'

export default defineComponent({
  components: {
    ExtensionSlot
  },
  props: {
    open: {
      type: Boolean,
      required: true
    },
    modelValue: {
      type: Object as PropType<DashboardStyle>,
      required: true
    },
    saving: {
      type: Boolean,
      default: false
    }
  },
  emits: ['update:modelValue', 'update:open', 'save'],
  setup(props, { emit }) {
    const { t } = useI18n()

    const groups = computed(() => DASHBOARD_STYLE_GROUPS.map(group => ({
      ...group,
      title: t(`pages.dashboard.style.groups.${group.id}`),
      fields: DASHBOARD_STYLE_FIELDS.filter(field => field.group === group.id)
    })))
    const fieldLabel = (field: DashboardStyleField) => t(`pages.dashboard.style.fields.${field.key}.label`)
    const fieldOptions = (field: DashboardStyleField) => (field.options ?? []).map(option => ({
      value: option.value,
      label: t(`pages.dashboard.style.fields.${field.key}.options.${option.value}`)
    }))
    const value = (key: string) => props.modelValue[key]
    const setValue = (key: string, next: unknown) => {
      const style = { ...props.modelValue }
      const empty = next === null || next === undefined || next === '' || next === false

      if (empty) delete style[key]
      else style[key] = next as string | number | boolean

      emit('update:modelValue', style)
    }
    const setNumber = (key: string, next: unknown) => {
      const number = next === '' || next === null || next === undefined ? Number.NaN : Number(next)

      setValue(key, Number.isFinite(number) ? number : null)
    }
    const reset = () => emit('update:modelValue', {})
    const canSave = computed(() => appExtensions.canSaveDashboardStyle?.(props.modelValue) ?? true)

    return {
      canSave,
      fieldLabel,
      fieldOptions,
      groups,
      reset,
      setNumber,
      setValue,
      t,
      value
    }
  }
})

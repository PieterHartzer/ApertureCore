import { computed, defineComponent, type PropType } from 'vue'

import type { SavedSqlQueryResultValue } from '~/types/saved-sql-queries'

export default defineComponent({
  props: {
    data: {
      type: Array as PropType<Array<Record<string, SavedSqlQueryResultValue>>>,
      required: true
    },
    config: {
      type: Object as PropType<Record<string, unknown>>,
      required: true
    },
    columns: {
      type: Array as PropType<string[]>,
      default: () => []
    }
  },
  setup(props) {
    const { locale, t } = useI18n()

    const valueField = computed(() => {
      return typeof props.config.valueField === 'string'
        ? props.config.valueField
        : ''
    })

    const labelField = computed(() => {
      return typeof props.config.labelField === 'string'
        ? props.config.labelField
        : ''
    })

    const firstRow = computed(() => {
      return props.data[0] ?? null
    })

    const rawValue = computed(() => {
      if (!firstRow.value || !valueField.value) {
        return null
      }

      return firstRow.value[valueField.value] ?? null
    })

    const formattedValue = computed(() => {
      if (typeof rawValue.value === 'number') {
        return new Intl.NumberFormat(locale.value).format(rawValue.value)
      }

      if (typeof rawValue.value === 'boolean') {
        return rawValue.value
          ? t('pages.dashboard.plugins.stat-card.boolean.true')
          : t('pages.dashboard.plugins.stat-card.boolean.false')
      }

      return rawValue.value === null
        ? t('pages.dashboard.plugins.stat-card.emptyValue')
        : String(rawValue.value)
    })

    const supportingLabel = computed(() => {
      if (!firstRow.value || !labelField.value) {
        return ''
      }

      const value = firstRow.value[labelField.value]

      return value === null
        ? ''
        : String(value)
    })

    return {
      firstRow,
      formattedValue,
      supportingLabel,
      t,
      valueField
    }
  }
})

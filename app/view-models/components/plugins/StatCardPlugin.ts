import { computed, defineComponent, type PropType } from 'vue'

import type { SavedSqlQueryResultValue } from '~/types/saved-sql-queries'

import { bandFor, getTextStyles, hasValueFormat, resolveBands } from '~/utils/charts/chart-settings'
import { findColumnFormat, isNumberKind, numberFormatterFor } from '~/utils/charts/column-formats'

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

    // Formats apply to numbers the database returned as text as well.
    const columnFormat = computed(() => findColumnFormat(props.config, valueField.value))
    const numericValue = computed(() => {
      // A column set to show as text is shown exactly as the database returned it.
      if (columnFormat.value?.kind === 'text') return null
      if (typeof rawValue.value === 'number') return rawValue.value

      const formatted = hasValueFormat(props.config) || (columnFormat.value && isNumberKind(columnFormat.value.kind))

      if (typeof rawValue.value === 'string' && formatted && rawValue.value.trim() !== '' && Number.isFinite(Number(rawValue.value))) return Number(rawValue.value)
      return null
    })

    const textStyles = computed(() => getTextStyles(props.config))

    const band = computed(() => numericValue.value === null ? null : bandFor(resolveBands(props.config), numericValue.value))

    const formattedValue = computed(() => {
      if (numericValue.value !== null) {
        return numberFormatterFor(props.config, locale.value === 'pseudo' ? 'en' : locale.value, valueField.value).full(numericValue.value)
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
      band,
      textStyles,
      formattedValue,
      supportingLabel,
      t,
      valueField
    }
  }
})

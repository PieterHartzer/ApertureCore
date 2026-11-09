import { computed, defineComponent, type PropType } from 'vue'

import type { SavedSqlQueryResultRow } from '~/types/saved-sql-queries'

import { createValueFormatter, getTextStyles, hasValueFormat, overrideLabel } from '~/utils/charts/chart-settings'

export default defineComponent({
  props: {
    data: {
      type: Array as PropType<SavedSqlQueryResultRow[]>,
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

    const tableColumns = computed(() => {
      const availableColumns = props.columns.length > 0
        ? props.columns
        : Object.keys(props.data[0] ?? {})
      const selectedColumns = Array.isArray(props.config.visibleColumns)
        ? props.config.visibleColumns.filter((value): value is string => {
            return typeof value === 'string' && value.trim().length > 0
          })
        : []
      const selectedColumnSet = new Set(selectedColumns)
      const columnNames = selectedColumnSet.size > 0
        ? availableColumns.filter((columnName) => selectedColumnSet.has(columnName))
        : availableColumns

      const formatter = createValueFormatter(props.config, locale.value === 'pseudo' ? 'en' : locale.value)
      const formatColumns = Array.isArray(props.config.formatColumns) ? props.config.formatColumns : []
      const isFormatted = (columnName: string) => formatColumns.length === 0 || formatColumns.includes(columnName)
      const formatCell = (value: unknown) => value === null || value === undefined ? '' : formatter.full(Number(value))

      return columnNames.map((columnName) => {
        const values = props.data.map((row) => row[columnName]).filter((value) => value !== null)
        const numeric = values.length > 0 && values.every((value) => {
          return typeof value === 'number' || (typeof value === 'string' && /^-?\d+(\.\d+)?$/.test(value))
        })

        return {
          accessorKey: columnName,
          header: overrideLabel(props.config, columnName),
          ...(numeric ? { meta: { class: { th: 'text-right', td: 'text-right tabular-nums' } } } : {}),
          ...(numeric && hasValueFormat(props.config) && isFormatted(columnName)
            ? { cell: ({ getValue }: { getValue: () => unknown }) => formatCell(getValue()) }
            : {})
        }
      })
    })

    const tableTextStyle = computed(() => getTextStyles(props.config).table)

    return {
      t,
      tableColumns,
      tableTextStyle
    }
  }
})

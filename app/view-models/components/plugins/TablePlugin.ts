import { computed, defineComponent, type PropType } from 'vue'

import type { SavedSqlQueryResultRow } from '~/types/saved-sql-queries'

import { getTextStyles, hasValueFormat, overrideLabel } from '~/utils/charts/chart-settings'
import { findColumnFormat, isNumberKind, numberFormatterFor } from '~/utils/charts/column-formats'

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

      const numberLocale = locale.value === 'pseudo' ? 'en' : locale.value
      const formatColumns = Array.isArray(props.config.formatColumns) ? props.config.formatColumns : []
      const isFormatted = (columnName: string) => formatColumns.length === 0 || formatColumns.includes(columnName)
      const formatCell = (columnName: string) => {
        const formatter = numberFormatterFor(props.config, numberLocale, columnName)

        return (value: unknown) => value === null || value === undefined ? '' : formatter.full(Number(value))
      }
      // A column's own rule wins; otherwise the widget's general number format applies, as before.
      const formatsColumn = (columnName: string) => {
        const rule = findColumnFormat(props.config, columnName)

        return rule ? isNumberKind(rule.kind) : hasValueFormat(props.config) && isFormatted(columnName)
      }

      return columnNames.map((columnName) => {
        const values = props.data.map((row) => row[columnName]).filter((value) => value !== null)
        const numeric = values.length > 0 && values.every((value) => {
          return typeof value === 'number' || (typeof value === 'string' && /^-?\d+(\.\d+)?$/.test(value))
        })

        return {
          accessorKey: columnName,
          header: overrideLabel(props.config, columnName),
          ...(numeric ? { meta: { class: { th: 'text-right', td: 'widget-table-number text-right tabular-nums' } } } : {}),
          ...(numeric && formatsColumn(columnName)
            ? { cell: ({ getValue }: { getValue: () => unknown }) => formatCell(columnName)(getValue()) }
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

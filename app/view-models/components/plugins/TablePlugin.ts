import { computed, defineComponent, type PropType } from 'vue'

import type { SavedSqlQueryResultRow } from '~/types/saved-sql-queries'

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
    const { t } = useI18n()

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

      return columnNames.map((columnName) => ({
        accessorKey: columnName,
        header: columnName
      }))
    })

    return {
      t,
      tableColumns
    }
  }
})

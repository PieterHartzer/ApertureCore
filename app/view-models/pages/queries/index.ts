import ExtensionSlot from '~/components/ui/ExtensionSlot.vue'
import AppEmptyState from '~/components/ui/AppEmptyState.vue'
import { computed, defineComponent, h, ref } from 'vue'
import { getPaginationRowModel, type Column, type SortingState } from '@tanstack/vue-table'

import { UButton } from '#components'

import { appExtensions } from '~/extensions'

import DeleteSavedSqlQueryDialog from '~/components/database/DeleteSavedSqlQueryDialog.vue'
import AppAlert from '~/components/ui/AppAlert.vue'
import AppLocaleSelect from '~/components/ui/AppLocaleSelect.vue'
import { useSavedSqlQueryDelete } from '~/composables/database/useSavedSqlQueryDelete'
import { useSavedSqlQueries } from '~/composables/database/useSavedSqlQueries'
import { useNotifications } from '~/composables/ui/useNotifications'
import type { SavedSqlQueryDeleteRequest } from '~/types/saved-sql-queries'
import { translateMessage } from '~/utils/translateMessage'

interface SavedSqlQueryListItem {
  id: string
  queryName: string
  connectionId: string
  connectionName: string
}

export default defineComponent({
  components: {
    ExtensionSlot,
    AppEmptyState,
    AppAlert,
    AppLocaleSelect,
    DeleteSavedSqlQueryDialog
  },
  async setup() {
    const { t } = useI18n()
    // Needs the component's setup context, so it runs before the first await.
    const extraColumns = appExtensions.useQueryListColumns?.()
    const { success } = useNotifications()
    const { deleteQuery } = useSavedSqlQueryDelete()
    const requestFetch = import.meta.server
      ? useRequestFetch()
      : $fetch
    const { listQueries } = useSavedSqlQueries(requestFetch)
    const { data: listResponse, status, refresh } = await useAsyncData(
      'saved-sql-queries',
      listQueries
    )
    const selectedQuery = ref<SavedSqlQueryListItem | null>(null)
    const isDeleteDialogOpen = ref(false)
    const isDeleting = ref(false)
    const deleteDialogErrorMessage = ref('')

    // A header that sorts its column: ascending, descending, then back to unsorted.
    const sortableHeader = (label: string, numeric = false) => ({ column }: { column: Column<SavedSqlQueryListItem> }) => {
      const sorted = column.getIsSorted()

      return h(UButton, {
        'color': 'neutral',
        'variant': 'ghost',
        'size': 'xs',
        'label': label,
        'class': numeric ? '-mr-2.5 ml-auto flex' : '-ml-2.5',
        'trailingIcon': sorted === 'asc' ? 'i-lucide-arrow-up' : sorted === 'desc' ? 'i-lucide-arrow-down' : 'i-lucide-arrow-up-down',
        'aria-label': t('queries.index.table.sortBy', { column: label }),
        'onClick': () => column.toggleSorting(sorted === 'asc')
      })
    }

    const toneClass = { warning: 'text-warning', error: 'text-error' } as const

    const columns = computed(() => [
      {
        accessorKey: 'queryName',
        header: sortableHeader(t('queries.index.table.columns.queryName'))
      },
      {
        accessorKey: 'connectionName',
        header: sortableHeader(t('queries.index.table.columns.connectionName'))
      },
      ...(extraColumns?.value ?? []).map(extra => ({
        id: extra.id,
        accessorFn: (row: SavedSqlQueryListItem) => extra.value(row.id),
        header: sortableHeader(extra.header, extra.numeric),
        sortUndefined: 'last' as const,
        cell: ({ row }: { row: { original: SavedSqlQueryListItem } }) => {
          const tone = extra.tone?.(row.original.id)

          return h('span', { class: [extra.numeric ? 'block text-right tabular-nums' : '', tone ? toneClass[tone] : ''] }, extra.display(row.original.id))
        }
      })),
      {
        id: 'actions',
        header: t('queries.index.table.columns.actions')
      }
    ])

    const PAGE_SIZE = 25
    const sorting = ref<SortingState>([])
    const pagination = ref({ pageIndex: 0, pageSize: PAGE_SIZE })
    const paginationOptions = { getPaginationRowModel: getPaginationRowModel() }
    const onPageChange = (page: number) => {
      pagination.value = { ...pagination.value, pageIndex: page - 1 }
    }

    const queries = computed<SavedSqlQueryListItem[]>(() => {
      return listResponse.value?.ok
        ? listResponse.value.queries ?? []
        : []
    })

    const isLoading = computed(() => {
      return status.value === 'pending'
    })

    const listErrorMessage = computed(() => {
      if (!listResponse.value || listResponse.value.ok) {
        return ''
      }

      return translateMessage(
        t,
        listResponse.value.messageKey,
        'queries.list.errors.unexpected'
      )
    })

    const onDeleteDialogOpenChange = (open: boolean) => {
      isDeleteDialogOpen.value = open

      if (!open) {
        selectedQuery.value = null
        deleteDialogErrorMessage.value = ''
      }
    }

    const openDeleteDialog = (query: SavedSqlQueryListItem) => {
      selectedQuery.value = query
      deleteDialogErrorMessage.value = ''
      isDeleteDialogOpen.value = true
    }

    const onDeleteConfirm = async (payload: SavedSqlQueryDeleteRequest) => {
      if (!selectedQuery.value) {
        return
      }

      isDeleting.value = true
      deleteDialogErrorMessage.value = ''

      try {
        const response = await deleteQuery(selectedQuery.value.id, payload)
        const message = translateMessage(
          t,
          response.messageKey,
          response.ok
            ? 'queries.delete.success'
            : 'queries.delete.errors.unexpected'
        )

        if (response.ok) {
          onDeleteDialogOpenChange(false)
          await refresh()
          success(message, t('queries.delete.notifications.successTitle'))
          return
        }

        deleteDialogErrorMessage.value = message
      } finally {
        isDeleting.value = false
      }
    }

    return {
      columns,
      onPageChange,
      PAGE_SIZE,
      pagination,
      paginationOptions,
      sorting,
      deleteDialogErrorMessage,
      isDeleteDialogOpen,
      isDeleting,
      isLoading,
      listErrorMessage,
      onDeleteConfirm,
      onDeleteDialogOpenChange,
      openDeleteDialog,
      queries,
      selectedQuery,
      t
    }
  }
})

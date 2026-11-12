<script>
import component from '~/view-models/pages/queries/index'

export default component
</script>

<template>
  <UPage>
    <UPageHeader
      :headline="t('queries.index.headline')"
      :title="t('queries.index.title')"
      :description="t('queries.index.description')"
      class="pb-6"
    >
      <template #links>
        <div class="flex items-center gap-3 sm:gap-4">


          <UButton
            to="/sql-workspace"
            icon="i-lucide-plus"
            :label="t('queries.index.actions.new')"
          />
        </div>
      </template>
    </UPageHeader>

    <UPageBody>
      <ExtensionSlot name="queries.index" :slot-props="{ count: queries.length }" />

      <AppAlert
        v-if="listErrorMessage"
        kind="error"
        :title="t('queries.index.errors.loadTitle')"
      >
        {{ localizeAppMessage($t, listErrorMessage) }}
      </AppAlert>

      <div
        v-else-if="isLoading || queries.length > 0"
        class="overflow-hidden rounded-lg border border-default bg-elevated"
      >
        <UTable
          v-model:sorting="sorting"
          v-model:pagination="pagination"
          :pagination-options="paginationOptions"
          :data="queries"
          :columns="columns"
          :loading="isLoading"
          :empty="t('queries.index.table.empty')"
        >
          <template #queryName-cell="{ row }">
            <NuxtLink :to="{ path: '/sql-workspace', query: { queryId: row.original.id } }" class="font-medium text-highlighted hover:underline">
              {{ row.original.queryName }}
            </NuxtLink>
          </template>

          <template #actions-header><span class="sr-only">{{ t('queries.index.table.columns.actions') }}</span></template>

          <template #actions-cell="{ row }">
            <div class="flex justify-end gap-1">
              <UButton :to="{ path: '/sql-workspace', query: { queryId: row.original.id } }" color="neutral" variant="ghost" size="sm" square icon="i-lucide-pencil" :aria-label="`${t('queries.index.table.actions.edit')} ${row.original.queryName}`" :title="t('queries.index.table.actions.edit')" />
              <UButton type="button" color="neutral" variant="ghost" size="sm" square icon="i-lucide-trash-2" :aria-label="`${t('queries.index.table.actions.delete')} ${row.original.queryName}`" :title="t('queries.index.table.actions.delete')" @click="openDeleteDialog(row.original)" />
            </div>
          </template>
        </UTable>

        <div v-if="queries.length > PAGE_SIZE" class="flex justify-end border-t border-default px-4 py-3">
          <UPagination
            :page="pagination.pageIndex + 1"
            :items-per-page="PAGE_SIZE"
            :total="queries.length"
            @update:page="onPageChange"
          />
        </div>
      </div>

      <AppEmptyState
        v-else
        icon="i-lucide-file-code-2"
        :title="t('queries.index.empty.title')"
        :description="t('queries.index.empty.description')"
      >
        <UButton to="/sql-workspace" icon="i-lucide-plus" :label="t('queries.index.actions.addFirst')" />
      </AppEmptyState>

      <DeleteSavedSqlQueryDialog
        :open="isDeleteDialogOpen"
        :query-name="selectedQuery?.queryName ?? ''"
        :is-deleting="isDeleting"
        :error-message="deleteDialogErrorMessage"
        @update:open="onDeleteDialogOpenChange"
        @confirm="onDeleteConfirm"
      />
    </UPageBody>
  </UPage>
</template>

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
    >
      <template #links>
        <div class="flex items-center gap-3">
          <AppLocaleSelect />
          <UButton
            to="/queries/new"
            icon="i-lucide-plus"
            :label="t('queries.index.actions.new')"
          />
        </div>
      </template>
    </UPageHeader>

    <UPageBody>
      <AppAlert
        v-if="listErrorMessage"
        kind="error"
        :title="t('queries.index.errors.loadTitle')"
      >
        {{ listErrorMessage }}
      </AppAlert>

      <UPageCard
        v-else-if="isLoading || queries.length > 0"
        icon="i-lucide-file-code-2"
        :title="t('queries.index.table.title')"
        :description="t('queries.index.table.description')"
      >
        <UTable
          :data="queries"
          :columns="columns"
          :loading="isLoading"
          :empty="t('queries.index.table.empty')"
        >
          <template #actions-cell="{ row }">
            <div class="flex items-center gap-2">
              <UButton
                :to="`/queries/${row.original.id}`"
                color="neutral"
                variant="ghost"
                icon="i-lucide-pencil"
                :label="t('queries.index.table.actions.edit')"
              />
              <UButton
                type="button"
                color="error"
                variant="ghost"
                icon="i-lucide-trash-2"
                :label="t('queries.index.table.actions.delete')"
                @click="openDeleteDialog(row.original)"
              />
            </div>
          </template>
        </UTable>
      </UPageCard>

      <UPageCard
        v-else
        icon="i-lucide-file-search"
        :title="t('queries.index.empty.title')"
        :description="t('queries.index.empty.description')"
      >
        <UButton
          to="/queries/new"
          icon="i-lucide-file-plus-2"
          :label="t('queries.index.actions.addFirst')"
        />
      </UPageCard>

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

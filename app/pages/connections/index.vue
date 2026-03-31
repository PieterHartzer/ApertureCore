<script>
import component from '~/view-models/pages/connections/index'

export default component
</script>

<template>
  <UPage>
    <UPageHeader
      :headline="t('connections.index.headline')"
      :title="t('connections.index.title')"
      :description="t('connections.index.description')"
    >
      <template #links>
        <div class="flex items-center gap-3">
          <AppLocaleSelect />
          <UButton
            to="/connections/new"
            icon="i-lucide-plus"
            :label="t('connections.index.actions.new')"
          />
        </div>
      </template>
    </UPageHeader>

    <UPageBody>
      <AppAlert
        v-if="listErrorMessage"
        kind="error"
        :title="t('connections.index.errors.loadTitle')"
      >
        {{ listErrorMessage }}
      </AppAlert>

      <UPageCard
        v-else-if="isLoading || connections.length > 0"
        icon="i-lucide-table-properties"
        :title="t('connections.index.table.title')"
        :description="t('connections.index.table.description')"
      >
        <UTable
          :data="connections"
          :columns="columns"
          :loading="isLoading"
          :empty="t('connections.index.table.empty')"
        >
          <template #databaseType-cell="{ row }">
            {{ formatDatabaseType(row.original.databaseType) }}
          </template>

          <template #actions-cell="{ row }">
            <div class="flex items-center gap-2">
              <UButton
                :to="`/connections/${row.original.id}`"
                color="neutral"
                variant="ghost"
                icon="i-lucide-pencil"
                :label="t('connections.index.table.actions.edit')"
              />
              <UButton
                type="button"
                color="error"
                variant="ghost"
                icon="i-lucide-trash-2"
                :label="t('connections.index.table.actions.delete')"
                @click="openDeleteDialog(row.original)"
              />
            </div>
          </template>
        </UTable>
      </UPageCard>

      <UPageCard
        v-else
        icon="i-lucide-database"
        :title="t('connections.index.empty.title')"
        :description="t('connections.index.empty.description')"
      >
        <UButton
          to="/connections/new"
          icon="i-lucide-database-zap"
          :label="t('connections.index.actions.addFirst')"
        />
      </UPageCard>

      <DeleteConnectionDialog
        :open="isDeleteDialogOpen"
        :connection-name="selectedConnection?.connectionName ?? ''"
        :is-deleting="isDeleting"
        :error-message="deleteDialogErrorMessage"
        @update:open="onDeleteDialogOpenChange"
        @confirm="onDeleteConfirm"
      />
    </UPageBody>
  </UPage>
</template>

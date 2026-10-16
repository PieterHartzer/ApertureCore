<script>
import component from '~/view-models/pages/connections/index'

export default component
</script>

<template>
  <UPage class="px-4 sm:px-6 lg:px-8">
    <UPageHeader
      :headline="t('connections.index.headline')"
      :title="t('connections.index.title')"
      :description="t('connections.index.description')"
      class="pb-6"
    >
      <template #links>
        <div class="flex items-center gap-3 sm:gap-4">

          <UButton
            to="/connections/new"
            icon="i-lucide-plus"
            :label="t('connections.index.actions.new')"
          />
        </div>
      </template>
    </UPageHeader>

    <UPageBody class="space-y-6 sm:space-y-8">
      <AppAlert
        v-if="listErrorMessage"
        kind="error"
        :title="t('connections.index.errors.loadTitle')"
      >
        {{ localizeAppMessage($t, listErrorMessage) }}
      </AppAlert>

      <UPageCard
        v-else-if="isLoading || connections.length > 0"
        icon="i-lucide-table-properties"
        :title="t('connections.index.table.title')"
        :description="t('connections.index.table.description')"
        class="space-y-4 sm:space-y-6"
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
            <div class="flex items-center gap-2 sm:gap-3">
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

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
      class="pb-6"
    >
      <template #links>
        <div class="flex items-center gap-3 sm:gap-4">

          <UButton
            to="/connections/new"
            icon="i-lucide-plus"
            :disabled="isCreationBlocked"
            :label="t('connections.index.actions.new')"
          />
        </div>
      </template>
    </UPageHeader>

    <UPageBody>
      <ExtensionSlot name="connections.index" :slot-props="{ count: connections.length }" />

      <AppAlert
        v-if="listErrorMessage"
        kind="error"
        :title="t('connections.index.errors.loadTitle')"
      >
        {{ localizeAppMessage($t, listErrorMessage) }}
      </AppAlert>

      <div
        v-else-if="isLoading || connections.length > 0"
        class="overflow-hidden rounded-lg border border-default bg-elevated"
      >
        <UTable
          :data="connections"
          :columns="columns"
          :loading="isLoading"
          :empty="t('connections.index.table.empty')"
        >
          <template #connectionName-cell="{ row }">
            <NuxtLink :to="`/connections/${row.original.id}`" class="font-medium text-highlighted hover:underline">
              {{ row.original.connectionName }}
            </NuxtLink>
          </template>

          <template #databaseType-cell="{ row }">
            <UBadge color="neutral" variant="subtle" size="sm" :label="formatDatabaseType(row.original.databaseType)" />
          </template>

          <template #actions-header><span class="sr-only">{{ t('connections.index.table.columns.actions') }}</span></template>

          <template #actions-cell="{ row }">
            <div class="flex justify-end gap-1">
              <UButton :to="`/connections/${row.original.id}`" color="neutral" variant="ghost" size="sm" square icon="i-lucide-pencil" :aria-label="`${t('connections.index.table.actions.edit')} ${row.original.connectionName}`" :title="t('connections.index.table.actions.edit')" />
              <UButton type="button" color="neutral" variant="ghost" size="sm" square icon="i-lucide-trash-2" :aria-label="`${t('connections.index.table.actions.delete')} ${row.original.connectionName}`" :title="t('connections.index.table.actions.delete')" @click="openDeleteDialog(row.original)" />
            </div>
          </template>
        </UTable>
      </div>

      <AppEmptyState
        v-else
        icon="i-lucide-database"
        :title="t('connections.index.empty.title')"
        :description="t('connections.index.empty.description')"
      >
        <UButton to="/connections/new" icon="i-lucide-plus" :label="t('connections.index.actions.addFirst')" />
      </AppEmptyState>

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

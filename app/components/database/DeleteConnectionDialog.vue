<script>
import component from '~/view-models/components/database/DeleteConnectionDialog'

export default component
</script>

<template>
  <UModal
    :open="open"
    :title="t('connections.delete.dialog.title')"
    :description="t('connections.delete.dialog.description', { connectionName })"
    :dismissible="!isDeleting"
    :close="!isDeleting"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <div class="space-y-4">
        <UFormField
          name="confirmationName"
          :label="t('connections.delete.dialog.confirmationLabel')"
          :description="t('connections.delete.dialog.confirmationDescription')"
        >
          <UInput
            v-model="confirmationName"
            :placeholder="connectionName"
            class="w-full"
          />
        </UFormField>

        <UCheckbox
          v-model="deleteLinkedQueries"
          :label="t('connections.delete.dialog.deleteLinkedQueries.label')"
          :description="t('connections.delete.dialog.deleteLinkedQueries.description')"
        />

        <AppAlert
          v-if="errorMessage"
          kind="error"
          :title="t('connections.delete.notifications.errorTitle')"
        >
          {{ errorMessage }}
        </AppAlert>
      </div>
    </template>

    <template #footer>
      <div class="flex w-full justify-end gap-3">
        <UButton
          type="button"
          color="neutral"
          variant="ghost"
          :label="t('connections.delete.dialog.cancel')"
          :disabled="isDeleting"
          @click="closeDialog"
        />
        <UButton
          type="button"
          color="error"
          icon="i-lucide-trash-2"
          :label="isDeleting ? t('connections.delete.dialog.confirmLoading') : t('connections.delete.dialog.confirm')"
          :loading="isDeleting"
          :disabled="!isConfirmationMatch"
          @click="onConfirm"
        />
      </div>
    </template>
  </UModal>
</template>

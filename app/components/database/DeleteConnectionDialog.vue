<script setup lang="ts">
import AppAlert from '~/components/ui/AppAlert.vue'

interface DeleteConnectionDialogProps {
  open: boolean
  connectionName: string
  isDeleting?: boolean
  errorMessage?: string
}

interface DeleteConnectionDialogConfirmPayload {
  confirmationName: string
  deleteLinkedQueries: boolean
}

const props = withDefaults(
  defineProps<DeleteConnectionDialogProps>(),
  {
    isDeleting: false,
    errorMessage: ''
  }
)

const emit = defineEmits<{
  'update:open': [value: boolean]
  confirm: [payload: DeleteConnectionDialogConfirmPayload]
}>()

const { t } = useI18n()
const confirmationName = ref('')
const deleteLinkedQueries = ref(false)

const isConfirmationMatch = computed(() => {
  return confirmationName.value.trim() === props.connectionName
})

const resetForm = () => {
  confirmationName.value = ''
  deleteLinkedQueries.value = false
}

watch(
  () => props.open,
  (open) => {
    if (open) {
      resetForm()
    }
  }
)

watch(
  () => props.connectionName,
  () => {
    if (props.open) {
      resetForm()
    }
  }
)

const closeDialog = () => {
  if (props.isDeleting) {
    return
  }

  emit('update:open', false)
}

const onConfirm = () => {
  if (!isConfirmationMatch.value || props.isDeleting) {
    return
  }

  emit('confirm', {
    confirmationName: confirmationName.value.trim(),
    deleteLinkedQueries: deleteLinkedQueries.value
  })
}
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

<script setup lang="ts">
import AppAlert from '~/components/ui/AppAlert.vue'

interface DeleteSavedSqlQueryDialogProps {
  open: boolean
  queryName: string
  isDeleting?: boolean
  errorMessage?: string
}

interface DeleteSavedSqlQueryDialogConfirmPayload {
  confirmationName: string
}

const props = withDefaults(
  defineProps<DeleteSavedSqlQueryDialogProps>(),
  {
    isDeleting: false,
    errorMessage: ''
  }
)

const emit = defineEmits<{
  'update:open': [value: boolean]
  confirm: [payload: DeleteSavedSqlQueryDialogConfirmPayload]
}>()

const { t } = useI18n()
const confirmationName = ref('')

const isConfirmationMatch = computed(() => {
  return confirmationName.value.trim() === props.queryName
})

const resetForm = () => {
  confirmationName.value = ''
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
  () => props.queryName,
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
    confirmationName: confirmationName.value.trim()
  })
}
</script>

<template>
  <UModal
    :open="open"
    :title="t('queries.delete.dialog.title')"
    :description="t('queries.delete.dialog.description', { queryName })"
    :dismissible="!isDeleting"
    :close="!isDeleting"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <div class="space-y-4">
        <UFormField
          name="confirmationName"
          :label="t('queries.delete.dialog.confirmationLabel')"
          :description="t('queries.delete.dialog.confirmationDescription')"
        >
          <UInput
            v-model="confirmationName"
            :placeholder="queryName"
            class="w-full"
          />
        </UFormField>

        <AppAlert
          v-if="errorMessage"
          kind="error"
          :title="t('queries.delete.notifications.errorTitle')"
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
          :label="t('queries.delete.dialog.cancel')"
          :disabled="isDeleting"
          @click="closeDialog"
        />
        <UButton
          type="button"
          color="error"
          icon="i-lucide-trash-2"
          :label="isDeleting ? t('queries.delete.dialog.confirmLoading') : t('queries.delete.dialog.confirm')"
          :loading="isDeleting"
          :disabled="!isConfirmationMatch"
          @click="onConfirm"
        />
      </div>
    </template>
  </UModal>
</template>

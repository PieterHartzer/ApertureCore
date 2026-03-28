<script setup lang="ts">
import AppAlert from '~/components/ui/AppAlert.vue'

interface DeleteDashboardDialogProps {
  open: boolean
  dashboardName: string
  isDeleting?: boolean
  errorMessage?: string
}

interface DeleteDashboardDialogConfirmPayload {
  confirmationName: string
}

const props = withDefaults(
  defineProps<DeleteDashboardDialogProps>(),
  {
    isDeleting: false,
    errorMessage: ''
  }
)

const emit = defineEmits<{
  'update:open': [value: boolean]
  confirm: [payload: DeleteDashboardDialogConfirmPayload]
}>()

const { t } = useI18n()
const confirmationName = ref('')

const isConfirmationMatch = computed(() => {
  return confirmationName.value.trim() === props.dashboardName
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
  () => props.dashboardName,
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
    :title="t('pages.dashboard.selector.delete.title')"
    :description="t('pages.dashboard.selector.delete.description', { dashboardName })"
    :dismissible="!isDeleting"
    :close="!isDeleting"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <div class="space-y-4">
        <UFormField
          name="confirmationName"
          :label="t('pages.dashboard.selector.delete.confirmationLabel')"
          :description="t('pages.dashboard.selector.delete.confirmationDescription')"
        >
          <UInput
            v-model="confirmationName"
            :placeholder="dashboardName"
            class="w-full"
          />
        </UFormField>

        <AppAlert
          v-if="errorMessage"
          kind="error"
          :title="t('pages.dashboard.selector.delete.errorTitle')"
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
          :label="t('pages.dashboard.selector.delete.actions.cancel')"
          :disabled="isDeleting"
          @click="closeDialog"
        />
        <UButton
          type="button"
          color="error"
          icon="i-lucide-trash-2"
          :label="isDeleting ? t('pages.dashboard.selector.delete.actions.confirmLoading') : t('pages.dashboard.selector.delete.actions.confirm')"
          :loading="isDeleting"
          :disabled="!isConfirmationMatch"
          @click="onConfirm"
        />
      </div>
    </template>
  </UModal>
</template>

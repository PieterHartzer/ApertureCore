<script lang="ts" setup>
import type { DatabaseConnectionTestResponse } from '~/types/database'

import AppAlert from '~/components/ui/AppAlert.vue'
import { translateMessage } from '~/utils/translateMessage'

const props = defineProps<{
  result: DatabaseConnectionTestResponse | null
}>()

const { t } = useI18n()

const alertKind = computed(() => {
  return props.result?.ok ? 'success' : 'error'
})

const alertTitle = computed(() => {
  if (!props.result) {
    return ''
  }

  return props.result.ok
    ? t('connections.test.result.successTitle')
    : t('connections.test.result.errorTitle')
})

const alertMessage = computed(() => {
  if (!props.result) {
    return ''
  }

  return translateMessage(t, props.result.messageKey, props.result.message)
})
</script>

<template>
  <AppAlert
    v-if="result"
    :kind="alertKind"
    :title="alertTitle"
  >
    {{ alertMessage }}
  </AppAlert>
</template>

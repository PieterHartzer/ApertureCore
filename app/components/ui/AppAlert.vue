<script lang="ts" setup>
import type { FeedbackKind } from '~/theme/feedback'

import { FEEDBACK_THEME } from '~/theme/feedback'

const props = withDefaults(defineProps<{
  kind?: FeedbackKind
  title?: string
}>(), {
  kind: 'info',
  title: undefined
})

const tone = computed(() => {
  return FEEDBACK_THEME[props.kind]
})
</script>

<template>
  <UAlert
    :color="tone.color"
    :icon="tone.icon"
    variant="subtle"
    orientation="vertical"
    :title="title"
  >
    <template #description>
      <slot />
    </template>
  </UAlert>
</template>

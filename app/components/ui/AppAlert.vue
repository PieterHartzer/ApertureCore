<script>
import component from '~/view-models/components/ui/AppAlert'

export default component
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

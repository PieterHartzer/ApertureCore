<script setup lang="ts">
defineProps<{
  icon: string
  title: string
  description?: string
}>()
</script>

<template>
  <div class="flex flex-col items-center rounded-lg border border-dashed border-default px-6 py-14 text-center">
    <span class="grid size-10 place-items-center rounded-lg bg-elevated ring ring-default">
      <UIcon :name="icon" class="size-5 text-muted" aria-hidden="true" />
    </span>
    <h2 class="mt-4 text-sm font-medium text-highlighted">{{ title }}</h2>
    <p v-if="description" class="mt-1 max-w-md text-sm text-muted">{{ description }}</p>
    <div v-if="$slots.default" class="mt-5"><slot /></div>
  </div>
</template>

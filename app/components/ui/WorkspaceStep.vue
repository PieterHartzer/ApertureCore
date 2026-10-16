<script setup lang="ts">
defineProps<{ title: string, description?: string, icon: string }>()
const open = defineModel<boolean>('open', { default: true })
const contentId = useId()
</script>

<template>
  <section class="rounded-xl border border-default bg-default overflow-hidden">
    <h2>
      <button
        type="button"
        class="flex w-full items-center gap-3 p-6 text-left focus-visible:outline-2 focus-visible:outline-primary focus-visible:-outline-offset-2 sm:p-8"
        :aria-expanded="open"
        :aria-controls="contentId"
        @click="open = !open"
      >
        <UIcon :name="icon" class="size-5 shrink-0 text-primary" aria-hidden="true" />
        <span class="min-w-0 flex-1">
          <span class="block font-semibold text-highlighted">{{ title }}</span>
          <span v-if="description" class="mt-1 block text-sm font-normal text-muted">{{ description }}</span>
          <slot name="summary" />
        </span>
        <UIcon name="i-lucide-chevron-down" class="size-5 shrink-0 text-muted transition-transform" :class="{ 'rotate-180': open }" aria-hidden="true" />
      </button>
    </h2>
    <div v-show="open" :id="contentId" class="space-y-4 px-6 pb-6 sm:space-y-6 sm:px-8 sm:pb-8">
      <slot />
    </div>
  </section>
</template>

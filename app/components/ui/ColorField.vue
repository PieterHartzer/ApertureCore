<script>
import component from '~/view-models/components/ui/ColorField'

export default component
</script>

<template>
  <div class="flex h-8 min-w-0 items-center gap-2" data-color-field>
    <span class="relative h-8 w-10 shrink-0 overflow-hidden rounded border border-default bg-[repeating-conic-gradient(#8884_0%_25%,transparent_0%_50%)] bg-[length:8px_8px]">
      <span class="pointer-events-none absolute inset-0" :style="{ backgroundColor: modelValue ?? 'transparent' }" />
      <input
        type="color"
        class="absolute inset-0 size-full cursor-pointer opacity-0"
        :aria-label="label"
        :value="solid"
        @input="onSolidInput"
      >
    </span>
    <UInput
      v-if="modelValue"
      type="number"
      size="sm"
      class="w-[4.5rem] shrink-0"
      :min="0"
      :max="100"
      :aria-label="t('pages.dashboard.plugins.catalog.opacityFor', { name: label })"
      :title="t('pages.dashboard.plugins.catalog.opacity')"
      :model-value="opacity"
      @update:model-value="onOpacityInput"
    >
      <template #trailing>
        <span class="text-xs text-dimmed">%</span>
      </template>
    </UInput>
    <span class="min-w-0 flex-1 truncate font-mono text-xs text-muted">{{ modelValue ?? placeholder }}</span>
    <UButton
      v-if="modelValue && clearable"
      color="neutral"
      variant="ghost"
      size="xs"
      square
      icon="i-lucide-x"
      :aria-label="t('pages.dashboard.plugins.catalog.clearColor')"
      @click="$emit('update:modelValue', null)"
    />
  </div>
</template>

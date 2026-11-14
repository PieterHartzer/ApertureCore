<script>
import component from '~/view-models/components/ui/ColorField'

export default component
</script>

<template>
  <div class="min-w-0 space-y-2" data-color-field>
    <div class="flex h-8 min-w-0 items-center gap-2">
      <span class="relative h-8 w-10 shrink-0 overflow-hidden rounded border border-default bg-[repeating-conic-gradient(#8884_0%_25%,transparent_0%_50%)] bg-[length:8px_8px] focus-within:ring-2 focus-within:ring-primary">
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
        size="sm"
        class="min-w-0 flex-1"
        :ui="{ base: 'font-mono text-xs' }"
        :model-value="draft"
        :placeholder="placeholder || '#rrggbb'"
        :color="draftInvalid ? 'error' : undefined"
        :highlight="draftInvalid"
        :aria-label="t('pages.dashboard.plugins.catalog.hexColor', { label })"
        :aria-invalid="draftInvalid"
        spellcheck="false"
        autocomplete="off"
        @update:model-value="onHexInput"
        @blur="onHexBlur"
      />
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
    <div
      class="flex items-center gap-3"
      :title="modelValue ? undefined : t('pages.dashboard.plugins.catalog.opacityNeedsColor')"
    >
      <span :id="sliderLabelId" class="w-14 shrink-0 text-xs text-muted">{{ t('pages.dashboard.plugins.catalog.opacity') }}</span>
      <USlider
        size="sm"
        class="min-w-0 flex-1"
        :class="{ 'opacity-40 grayscale': !modelValue }"
        :min="0"
        :max="100"
        :step="5"
        :disabled="!modelValue"
        :model-value="opacity"
        :aria-labelledby="sliderLabelId"
        :aria-valuetext="`${opacity}%`"
        @update:model-value="onOpacityInput"
      />
      <span class="w-9 shrink-0 text-right font-mono text-xs tabular-nums" :class="modelValue ? 'text-highlighted' : 'text-dimmed'">{{ opacity }}%</span>
    </div>
  </div>
</template>

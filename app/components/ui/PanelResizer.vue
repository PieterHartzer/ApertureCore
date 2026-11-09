<script setup lang="ts">
const props = defineProps<{
  axis: 'x' | 'y'
  ratio: number
  label: string
}>()
const emit = defineEmits<{ update: [ratio: number] }>()
const root = ref<HTMLElement | null>(null)

const toRatio = (event: PointerEvent) => {
  const rect = root.value?.parentElement?.getBoundingClientRect()
  if (!rect) return props.ratio
  return props.axis === 'x'
    ? (event.clientX - rect.left) / rect.width
    : (event.clientY - rect.top) / rect.height
}
const onPointerDown = (event: PointerEvent) => {
  event.preventDefault()
  root.value?.setPointerCapture(event.pointerId)
}
const onPointerMove = (event: PointerEvent) => {
  if (root.value?.hasPointerCapture(event.pointerId)) emit('update', toRatio(event))
}
const onKeydown = (event: KeyboardEvent) => {
  const step = { ArrowLeft: -0.02, ArrowUp: -0.02, ArrowRight: 0.02, ArrowDown: 0.02 }[event.key]
  if (step === undefined) return
  event.preventDefault()
  emit('update', props.ratio + step)
}
</script>

<template>
  <div
    ref="root"
    role="separator"
    tabindex="0"
    class="panel-resizer"
    :data-axis="axis"
    :aria-label="label"
    :aria-orientation="axis === 'x' ? 'vertical' : 'horizontal'"
    :aria-valuenow="Math.round(ratio * 100)"
    aria-valuemin="15"
    aria-valuemax="80"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @keydown="onKeydown"
  />
</template>

<style scoped>
.panel-resizer {
  display: none;
  flex: none;
  position: relative;
  background: var(--ui-border);
  touch-action: none;
  transition: background-color var(--transition-fast);
}

.panel-resizer::after {
  content: '';
  position: absolute;
  z-index: 10;
}

.panel-resizer:hover,
.panel-resizer:focus-visible,
.panel-resizer:active {
  background: var(--ui-primary);
}

@media (min-width: 1024px) {
  .panel-resizer {
    display: block;
  }

  .panel-resizer[data-axis='x'] {
    width: 1px;
    cursor: col-resize;
  }

  .panel-resizer[data-axis='x']::after {
    inset: 0 -4px;
  }

  .panel-resizer[data-axis='y'] {
    height: 1px;
    cursor: row-resize;
  }

  .panel-resizer[data-axis='y']::after {
    inset: -4px 0;
  }
}
</style>

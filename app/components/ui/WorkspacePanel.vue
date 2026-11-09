<script setup lang="ts">
withDefaults(defineProps<{
  title: string
  icon: string
  collapsed: boolean
  canCollapse: boolean
  // Beside other panels a collapsed panel is a strip; stacked, it is a bar.
  stacked?: boolean
}>(), { stacked: false })
defineEmits<{ toggle: [] }>()
</script>

<template>
  <section class="workspace-panel" :data-collapsed="collapsed ? 'true' : 'false'" :data-stacked="stacked ? 'true' : 'false'">
    <button
      v-if="collapsed"
      type="button"
      class="workspace-panel-strip"
      :aria-label="$t('workspace.expandPanel', { panel: title })"
      @click="$emit('toggle')"
    >
      <UIcon :name="icon" class="size-4 shrink-0" aria-hidden="true" />
      <span class="workspace-panel-strip-label">{{ title }}</span>
    </button>

    <template v-else>
      <header class="flex h-11 flex-none items-center gap-2 border-b border-default pl-3 pr-1.5">
        <UIcon :name="icon" class="size-4 shrink-0 text-muted" aria-hidden="true" />
        <h2 class="min-w-0 flex-1 truncate text-[13px] font-medium text-highlighted">{{ title }}</h2>
        <slot name="actions" />
        <UButton
          color="neutral"
          variant="ghost"
          size="xs"
          square
          icon="i-lucide-minimize-2"
          :disabled="!canCollapse"
          :aria-label="$t('workspace.collapsePanel', { panel: title })"
          :title="$t('workspace.collapsePanel', { panel: title })"
          @click="$emit('toggle')"
        />
      </header>
      <div class="workspace-panel-body flex min-h-0 flex-1 flex-col">
        <slot />
      </div>
    </template>
  </section>
</template>

<style scoped>
.workspace-panel {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  height: 100%;
}

.workspace-panel-body {
  animation: workspace-panel-in 240ms ease-out;
}

@keyframes workspace-panel-in {
  from {
    opacity: 0;
  }
}

.workspace-panel-strip {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 11px 14px;
  font-size: 13px;
  font-weight: 500;
  color: var(--ui-text-muted);
  cursor: pointer;
  transition: color var(--transition-fast), background-color var(--transition-fast);
}

.workspace-panel-strip:hover {
  color: var(--ui-text-highlighted);
  background-color: color-mix(in oklab, var(--ui-bg-accented) 45%, transparent);
}

@media (min-width: 1024px) {
  .workspace-panel[data-collapsed='true'][data-stacked='false'] .workspace-panel-strip {
    flex-direction: column;
    gap: 14px;
    height: 100%;
    padding: 14px 0;
  }

  .workspace-panel[data-collapsed='true'][data-stacked='false'] .workspace-panel-strip-label {
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    white-space: nowrap;
    writing-mode: vertical-rl;
    transform: rotate(180deg);
  }
}
</style>

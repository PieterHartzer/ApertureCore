<script>
import component from '~/view-models/components/dashboard/WidgetGrid'

export default component
</script>

<template>
  <div
    ref="gridRoot"
    class="grid-stack dashboard-widget-grid"
    :data-grid-ready="isGridReady ? 'true' : 'false'"
  >
    <div
      v-for="widget in widgets"
      :key="widget.id"
      class="grid-stack-item"
      :style="getPendingItemStyle(widget)"
      :data-dashboard-widget-id="widget.id"
      :gs-id="widget.id"
      :gs-x="widget.layout.x"
      :gs-y="widget.layout.y"
      :gs-w="widget.layout.w"
      :gs-h="widget.layout.h"
      :gs-min-w="widget.layout.minW"
      :gs-max-w="widget.layout.maxW"
      :gs-min-h="widget.layout.minH"
      :gs-max-h="widget.layout.maxH"
    >
      <div class="grid-stack-item-content">
        <slot
          name="item"
          :widget="widget"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.dashboard-widget-grid {
  min-height: 28rem;
  margin: 0 -6px;
}

.dashboard-widget-grid[data-grid-ready='false'] {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  grid-auto-rows: 72px;
}

.dashboard-widget-grid[data-grid-ready='false'] > :deep(.grid-stack-item) {
  position: relative;
  grid-column: var(--pending-column);
  grid-row: var(--pending-row);
}

.dashboard-widget-grid[data-grid-ready='false'] > :deep(.grid-stack-item) > .grid-stack-item-content {
  position: absolute;
  inset: 6px;
  width: auto;
  height: auto;
}

@media (max-width: 767px) {
  .dashboard-widget-grid[data-grid-ready='false'] > :deep(.grid-stack-item) {
    grid-column: 1 / -1;
    grid-row: var(--pending-height);
  }
}

.dashboard-widget-grid :deep(.grid-stack-item-content) {
  display: flex;
  min-width: 0;
  min-height: 0;
  /* The card clips its own content; this must not clip the card's shadow. */
  overflow: visible;
  background: transparent;
  border-radius: 0;
  box-shadow: none;
}

.dashboard-widget-grid :deep(.grid-stack-item-content > *) {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
}

/* Enhanced Widget Grid Layout */
.dashboard-widget-grid :deep(.grid-stack) {
  padding: 0;
  background: transparent;
}

.dashboard-widget-grid :deep(.grid-stack-item) {
  transition: transform var(--transition-base), box-shadow var(--transition-base);
}

.dashboard-widget-grid :deep(.grid-stack-item:hover) {
  z-index: 10;
}

.dashboard-widget-grid :deep(.grid-stack-placeholder) {
  background: var(--color-muted);
  border: 1px dashed var(--color-border);
  border-radius: 10px;
}

/* Drag State */
.dashboard-widget-grid :deep(.grid-stack-item.dragging) {
  opacity: 0.9;
  box-shadow: var(--shadow-xl);
  z-index: 100;
}

.dashboard-widget-grid :deep(.grid-stack-item.dragging .grid-stack-item-content) {
  border: 2px solid var(--color-primary);
}

/* Edit Mode Indicators */
.dashboard-widget-grid.edit-mode :deep(.grid-stack-item) {
  border: 2px solid var(--color-border);
  border-radius: 8px;
}

.dashboard-widget-grid.edit-mode :deep(.grid-stack-item:hover) {
  border-color: var(--color-primary);
  box-shadow: var(--shadow-md);
}
</style>

<script>
import component from '~/view-models/components/dashboard/WidgetGrid'

export default component
</script>

<template>
  <div
    ref="gridRoot"
    class="grid-stack dashboard-widget-grid"
  >
    <div
      v-for="widget in widgets"
      :key="widget.id"
      class="grid-stack-item"
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
  gap: var(--space-md);
}

.dashboard-widget-grid :deep(.grid-stack-item-content) {
  display: flex;
  height: 100%;
  width: 100%;
  min-width: 0;
  min-height: 0;
  inset: 0;
  overflow: hidden;
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
  padding: var(--space-md);
  background: var(--color-background);
}

.dashboard-widget-grid :deep(.grid-stack-item) {
  transition: transform var(--transition-base), box-shadow var(--transition-base);
}

.dashboard-widget-grid :deep(.grid-stack-item:hover) {
  z-index: 10;
}

.dashboard-widget-grid :deep(.grid-stack-placeholder) {
  background: var(--color-muted);
  border: 2px dashed var(--color-border);
  border-radius: 8px;
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
  overflow: hidden;
}

.dashboard-widget-grid.edit-mode :deep(.grid-stack-item:hover) {
  border-color: var(--color-primary);
  box-shadow: var(--shadow-md);
}

/* Responsive Grid */
@media (max-width: 640px) {
  .dashboard-widget-grid {
    padding: var(--space-sm);
    gap: var(--space-sm);
  }
}

@media (min-width: 768px) {
  .dashboard-widget-grid {
    padding: var(--space-md);
  }
}

@media (min-width: 1024px) {
  .dashboard-widget-grid {
    padding: var(--space-lg);
  }
}
</style>

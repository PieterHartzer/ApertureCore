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
</style>

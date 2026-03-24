<script setup lang="ts">
import type {
  GridItemHTMLElement,
  GridStack,
  GridStackNode,
  GridStackWidget
} from 'gridstack'

import type {
  DashboardWidget,
  DashboardWidgetLayout,
  DashboardWidgetLayoutUpdate
} from '~/types/dashboard-widgets'
import {
  normalizeDashboardWidgetLayout
} from '~/types/dashboard-widgets'

import 'gridstack/dist/gridstack.min.css'

const GRIDSTACK_COLUMN_COUNT = 12
const GRIDSTACK_CELL_HEIGHT_PX = 96
const GRIDSTACK_MARGIN_PX = 16

const props = defineProps<{
  editable?: boolean
  widgets: DashboardWidget[]
}>()

const emit = defineEmits<{
  layoutChange: [updates: DashboardWidgetLayoutUpdate[]]
}>()

const gridRoot = ref<HTMLElement | null>(null)

let grid: GridStack | null = null
let isApplyingGridState = false

const areLayoutsEqual = (
  currentLayout: DashboardWidgetLayout,
  nextLayout: DashboardWidgetLayout
) => {
  return (
    currentLayout.x === nextLayout.x &&
    currentLayout.y === nextLayout.y &&
    currentLayout.w === nextLayout.w &&
    currentLayout.h === nextLayout.h &&
    currentLayout.minW === nextLayout.minW &&
    currentLayout.maxW === nextLayout.maxW &&
    currentLayout.minH === nextLayout.minH &&
    currentLayout.maxH === nextLayout.maxH
  )
}

const buildGridStackWidget = (
  widget: DashboardWidget
): GridStackWidget => ({
  id: widget.id,
  ...widget.layout
})

const extractWidgetLayout = (
  node: Pick<GridStackNode, 'x' | 'y' | 'w' | 'h' | 'minW' | 'maxW' | 'minH' | 'maxH'>
) => {
  return normalizeDashboardWidgetLayout({
    x: node.x,
    y: node.y,
    w: node.w,
    h: node.h,
    minW: node.minW,
    maxW: node.maxW,
    minH: node.minH,
    maxH: node.maxH
  })
}

const getWidgetElement = (widgetId: string) => {
  if (!gridRoot.value) {
    return null
  }

  return [...gridRoot.value.querySelectorAll<HTMLElement>('[data-dashboard-widget-id]')]
    .find((element) => element.dataset.dashboardWidgetId === widgetId) as GridItemHTMLElement | undefined
}

const emitLayoutUpdates = (nodes: GridStackNode[]) => {
  if (isApplyingGridState) {
    return
  }

  const widgetLookup = new Map(props.widgets.map((widget) => [widget.id, widget]))
  const updates = new Map<string, DashboardWidgetLayoutUpdate>()

  for (const node of nodes) {
    if (typeof node.id !== 'string') {
      continue
    }

    const widget = widgetLookup.get(node.id)

    if (!widget) {
      continue
    }

    const nextLayout = extractWidgetLayout(node)

    if (areLayoutsEqual(widget.layout, nextLayout)) {
      continue
    }

    updates.set(node.id, {
      widgetId: node.id,
      layout: nextLayout
    })
  }

  if (updates.size > 0) {
    emit('layoutChange', [...updates.values()])
  }
}

const syncGridWithWidgets = async () => {
  if (!grid || !gridRoot.value) {
    return
  }

  await nextTick()

  isApplyingGridState = true

  try {
    const widgetIds = new Set(props.widgets.map((widget) => widget.id))

    grid.batchUpdate()

    for (const node of [...grid.engine.nodes]) {
      if (
        typeof node.id === 'string' &&
        !widgetIds.has(node.id) &&
        node.el
      ) {
        grid.removeWidget(node.el, false, false)
      }
    }

    const pendingLayoutUpdates: GridStackNode[] = []

    for (const widget of props.widgets) {
      const element = getWidgetElement(widget.id)

      if (!element) {
        continue
      }

      const nextGridWidget = buildGridStackWidget(widget)

      if (!element.gridstackNode) {
        const gridItemElement = grid.makeWidget(element, nextGridWidget)

        if (gridItemElement.gridstackNode) {
          pendingLayoutUpdates.push(gridItemElement.gridstackNode)
        }

        continue
      }

      if (
        !areLayoutsEqual(
          extractWidgetLayout(element.gridstackNode),
          widget.layout
        )
      ) {
        grid.update(element, nextGridWidget)
      }
    }

    grid.batchUpdate(false)

    isApplyingGridState = false
    emitLayoutUpdates(pendingLayoutUpdates)
  } finally {
    isApplyingGridState = false
  }
}

const syncGridEditingState = () => {
  if (!grid) {
    return
  }

  const isEditable = Boolean(props.editable)

  grid.enableMove(isEditable)
  grid.enableResize(isEditable)
}

watch(
  () => {
    return props.widgets.map((widget) => {
      const layout = widget.layout

      return [
        widget.id,
        layout.x ?? '',
        layout.y ?? '',
        layout.w,
        layout.h,
        layout.minW ?? '',
        layout.maxW ?? '',
        layout.minH ?? '',
        layout.maxH ?? ''
      ].join(':')
    }).join('|')
  },
  async () => {
    await syncGridWithWidgets()
  },
  {
    flush: 'post'
  }
)

watch(
  () => props.editable,
  () => {
    syncGridEditingState()
  }
)

onMounted(async () => {
  if (!gridRoot.value) {
    return
  }

  const { GridStack } = await import('gridstack')

  grid = GridStack.init({
    animate: true,
    auto: false,
    cellHeight: GRIDSTACK_CELL_HEIGHT_PX,
    column: GRIDSTACK_COLUMN_COUNT,
    disableDrag: !props.editable,
    disableResize: !props.editable,
    margin: GRIDSTACK_MARGIN_PX,
    handle: '[data-dashboard-widget-drag-handle]',
    alwaysShowResizeHandle: 'mobile',
    columnOpts: {
      breakpoints: [
        { w: 700, c: 1, layout: 'list' },
        { w: 1100, c: 6, layout: 'moveScale' },
        { c: GRIDSTACK_COLUMN_COUNT }
      ],
      layout: 'moveScale'
    }
  }, gridRoot.value)

  grid.on('change', (_event, nodes) => {
    emitLayoutUpdates(nodes)
  })

  syncGridEditingState()
  await syncGridWithWidgets()
})

onBeforeUnmount(() => {
  if (!grid) {
    return
  }

  grid.offAll()
  grid.destroy(false)
  grid = null
})
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

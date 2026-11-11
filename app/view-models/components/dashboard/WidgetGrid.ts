import { nextTick, onBeforeUnmount, onMounted, ref, watch, defineComponent, type PropType } from 'vue'
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
import { normalizeDashboardWidgetLayout } from '~/types/dashboard-widgets'

import 'gridstack/dist/gridstack.min.css'

const GRIDSTACK_COLUMN_COUNT = 12
const GRIDSTACK_CELL_HEIGHT_PX = 72
const GRIDSTACK_MARGIN_PX = 6

export default defineComponent({
  props: {
    editable: {
      type: Boolean,
      default: false
    },
    widgets: {
      type: Array as PropType<DashboardWidget[]>,
      required: true
    }
  },
  emits: ['layoutChange'],
  setup(props, { emit }) {
    const gridRoot = ref<HTMLElement | null>(null)
    const isGridReady = ref(false)

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

    // CSS grid places the cards from their saved layout until GridStack has
    // loaded. These stay as custom properties and the ready flag as a data
    // attribute because GridStack owns the element's inline styles and classes.
    const getPendingItemStyle = (widget: DashboardWidget) => {
      const { x, y, w, h } = widget.layout

      return {
        '--pending-column': x === undefined ? `span ${w}` : `${x + 1} / span ${w}`,
        '--pending-row': y === undefined ? `span ${h}` : `${y + 1} / span ${h}`,
        '--pending-height': `span ${h}`
      }
    }

    // A new widget goes below everything else, so it never fills a gap left on purpose.
    const buildGridStackWidget = (
      widget: DashboardWidget
    ): GridStackWidget => ({
      id: widget.id,
      ...widget.layout,
      ...(widget.layout.x === undefined && widget.layout.y === undefined && grid
        ? { x: 0, y: grid.getRow() }
        : {})
    })

    // Widgets stay where they are put, so empty rows and columns can be used for
    // spacing. On narrow screens they still close up into one column.
    const syncGridFloat = () => {
      grid?.float(grid.getColumn() === GRIDSTACK_COLUMN_COUNT)
    }

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
      // GridStack also reports the reflow it does for narrow screens, so only
      // an edit at full width may become the saved layout.
      if (
        isApplyingGridState ||
        !props.editable ||
        grid?.getColumn() !== GRIDSTACK_COLUMN_COUNT
      ) {
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
        float: true,
        handle: '[data-dashboard-widget-drag-handle]',
        alwaysShowResizeHandle: 'mobile',
        columnOpts: {
          breakpoints: [
            { w: 640, c: 1, layout: 'list' },
            { w: 900, c: 6, layout: 'moveScale' },
            { c: GRIDSTACK_COLUMN_COUNT }
          ],
          layout: 'moveScale'
        }
      }, gridRoot.value)

      grid.on('change', (_event, nodes) => {
        emitLayoutUpdates(nodes)
      })

      syncGridFloat()
      window.addEventListener('resize', syncGridFloat)

      syncGridEditingState()
      await syncGridWithWidgets()
      isGridReady.value = true
    })

    onBeforeUnmount(() => {
      window.removeEventListener('resize', syncGridFloat)

      if (!grid) {
        return
      }

      grid.offAll()
      grid.destroy(false)
      grid = null
    })

    return {
      getPendingItemStyle,
      gridRoot,
      isGridReady
    }
  }
})

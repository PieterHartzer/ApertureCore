import {
  BarChart,
  LineChart,
  PieChart
} from 'echarts/charts'
import { UniversalTransition, LabelLayout } from 'echarts/features'
import {
  AriaComponent,
  BrushComponent,
  DataZoomComponent,
  DatasetComponent,
  GridComponent,
  LegendComponent,
  MarkAreaComponent,
  MarkLineComponent,
  MarkPointComponent,
  TimelineComponent,
  TitleComponent,
  ToolboxComponent,
  TooltipComponent,
  TransformComponent,
  VisualMapComponent
} from 'echarts/components'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'

use([
  AriaComponent,
  BarChart,
  BrushComponent,
  DataZoomComponent,
  DatasetComponent,
  LabelLayout,
  MarkAreaComponent,
  MarkPointComponent,
  TimelineComponent,
  ToolboxComponent,
  TransformComponent,
  UniversalTransition,
  CanvasRenderer,
  GridComponent,
  LegendComponent,
  LineChart,
  MarkLineComponent,
  PieChart,
  TitleComponent,
  TooltipComponent,
  VisualMapComponent
])

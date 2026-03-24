import BarChartPlugin from '~/components/plugins/BarChartPlugin.vue'
import LineChartPlugin from '~/components/plugins/LineChartPlugin.vue'
import StatCardPlugin from '~/components/plugins/StatCardPlugin.vue'
import TablePlugin from '~/components/plugins/TablePlugin.vue'
import type { UIPluginDefinition } from '~/types/uiPlugin'

export const DEFAULT_UI_PLUGINS: UIPluginDefinition[] = [
  {
    id: 'table',
    name: 'Table',
    nameKey: 'pages.dashboard.plugins.table.name',
    description: 'Render raw query rows in a table.',
    descriptionKey: 'pages.dashboard.plugins.table.description',
    component: TablePlugin,
    inputSchema: [
      {
        key: 'visibleColumns',
        label: 'Visible columns',
        labelKey: 'pages.dashboard.plugins.table.fields.visibleColumns.label',
        description: 'Select the query columns to display. Leave empty to show every column.',
        descriptionKey: 'pages.dashboard.plugins.table.fields.visibleColumns.description',
        type: 'string',
        selectionMode: 'multiple'
      }
    ]
  },
  {
    id: 'line-chart',
    name: 'Line chart',
    nameKey: 'pages.dashboard.plugins.line-chart.name',
    description: 'Plot a numeric series against a label or date axis.',
    descriptionKey: 'pages.dashboard.plugins.line-chart.description',
    component: LineChartPlugin,
    inputSchema: [
      {
        key: 'xField',
        label: 'X axis field',
        labelKey: 'pages.dashboard.plugins.line-chart.fields.xField.label',
        type: 'string',
        required: true,
        compatibleFieldTypes: ['string', 'number', 'date']
      },
      {
        key: 'yField',
        label: 'Y axis field',
        labelKey: 'pages.dashboard.plugins.line-chart.fields.yField.label',
        type: 'string',
        required: true,
        compatibleFieldTypes: ['number']
      }
    ]
  },
  {
    id: 'bar-chart',
    name: 'Bar chart',
    nameKey: 'pages.dashboard.plugins.bar-chart.name',
    description: 'Compare a numeric series across categories.',
    descriptionKey: 'pages.dashboard.plugins.bar-chart.description',
    component: BarChartPlugin,
    inputSchema: [
      {
        key: 'xField',
        label: 'Category field',
        labelKey: 'pages.dashboard.plugins.bar-chart.fields.xField.label',
        type: 'string',
        required: true,
        compatibleFieldTypes: ['string', 'number', 'date']
      },
      {
        key: 'yField',
        label: 'Value field',
        labelKey: 'pages.dashboard.plugins.bar-chart.fields.yField.label',
        type: 'string',
        required: true,
        compatibleFieldTypes: ['number']
      }
    ]
  },
  {
    id: 'stat-card',
    name: 'Stat card',
    nameKey: 'pages.dashboard.plugins.stat-card.name',
    description: 'Highlight a single metric from the first result row.',
    descriptionKey: 'pages.dashboard.plugins.stat-card.description',
    component: StatCardPlugin,
    inputSchema: [
      {
        key: 'valueField',
        label: 'Value field',
        labelKey: 'pages.dashboard.plugins.stat-card.fields.valueField.label',
        type: 'string',
        required: true,
        compatibleFieldTypes: ['number', 'string']
      },
      {
        key: 'labelField',
        label: 'Label field',
        labelKey: 'pages.dashboard.plugins.stat-card.fields.labelField.label',
        type: 'string',
        compatibleFieldTypes: ['string', 'number', 'date']
      }
    ]
  }
]

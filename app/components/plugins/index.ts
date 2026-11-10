import BarChartPlugin from '~/components/plugins/BarChartPlugin.vue'
import LineChartPlugin from '~/components/plugins/LineChartPlugin.vue'
import StatCardPlugin from '~/components/plugins/StatCardPlugin.vue'
import TablePlugin from '~/components/plugins/TablePlugin.vue'
import CatalogChartPlugin from '~/components/plugins/CatalogChartPlugin.vue'
import type { PluginInputDefinition, UIPluginDefinition } from '~/types/uiPlugin'
import { CHART_CATALOG, CHART_SAMPLE_DATA, type CatalogChart, type ChartRow } from '~/utils/charts/chart-catalog'
import { CHART_SETTINGS, type ChartSetting } from '~/utils/charts/chart-settings'

export const catalogInput = (input: CatalogChart['inputs'][number]): PluginInputDefinition => ({
  key: input.key,
  label: input.key,
  labelKey: `pages.dashboard.plugins.catalog.fields.${input.key}`,
  type: 'string',
  required: input.required,
  ...(input.multiple ? { selectionMode: 'multiple' as const } : {}),
  compatibleFieldTypes: input.types
})

/** Pass the catalog's own sample rows so the widget gallery can draw an example. */
export const catalogPlugin = (chart: CatalogChart, sampleData: Record<string, ChartRow[]> = CHART_SAMPLE_DATA): UIPluginDefinition => ({
  id: chart.id,
  name: chart.name,
  nameKey: `pages.dashboard.plugins.${chart.id}.name`,
  description: chart.description,
  descriptionKey: `pages.dashboard.plugins.${chart.id}.description`,
  group: chart.group,
  component: CatalogChartPlugin,
  componentProps: { chartId: chart.id },
  inputSchema: chart.inputs.map(catalogInput),
  ...(sampleData[chart.sample.dataset] ? { sample: { rows: sampleData[chart.sample.dataset]!, config: chart.sample.config } } : {})
})

const settingKey = (key: string) => `pages.dashboard.plugins.catalog.settings.${key}`

export const settingInput = (setting: ChartSetting): PluginInputDefinition => ({
  key: setting.key,
  label: setting.label,
  labelKey: `${settingKey(setting.key)}.label`,
  type: 'string',
  source: 'value',
  control: setting.control,
  section: setting.section,
  span: setting.span,
  visibleWhen: setting.visibleWhen,
  min: setting.min,
  max: setting.max,
  options: setting.options?.map(option => ({
    value: option.value,
    label: option.label,
    ...(option.plain ? {} : { labelKey: `${settingKey(setting.key)}.options.${option.value}` })
  }))
})

const MONTHLY_REVENUE = ['2026-01-01', '2026-02-01', '2026-03-01', '2026-04-01', '2026-05-01', '2026-06-01', '2026-07-01', '2026-08-01']
  .map((month, index) => ({ month, revenue: 42 + index * 5 + (index % 3) * 7 }))

const BASE_PLUGINS: UIPluginDefinition[] = [
  {
    id: 'table',
    name: 'Table',
    nameKey: 'pages.dashboard.plugins.table.name',
    description: 'Render raw query rows in a table.',
    descriptionKey: 'pages.dashboard.plugins.table.description',
    group: 'table',
    component: TablePlugin,
    sample: {
      rows: [
        { order: '#1042', customer: 'Northwind', total: 1250, status: 'Paid' },
        { order: '#1043', customer: 'Contoso', total: 860, status: 'Pending' },
        { order: '#1044', customer: 'Fabrikam', total: 2310, status: 'Paid' },
        { order: '#1045', customer: 'Tailspin', total: 415, status: 'Refunded' }
      ],
      config: {}
    },
    inputSchema: [
      {
        key: 'visibleColumns',
        label: 'Visible columns',
        labelKey: 'pages.dashboard.plugins.table.fields.visibleColumns.label',
        description: 'Select the query columns to display. Leave empty to show every column.',
        descriptionKey: 'pages.dashboard.plugins.table.fields.visibleColumns.description',
        type: 'string',
        selectionMode: 'multiple'
      },
      {
        key: 'formatColumns',
        label: 'Columns to format',
        labelKey: 'pages.dashboard.plugins.catalog.fields.formatColumns',
        type: 'string',
        selectionMode: 'multiple',
        compatibleFieldTypes: ['number']
      }
    ]
  },
  {
    id: 'line-chart',
    name: 'Line chart',
    nameKey: 'pages.dashboard.plugins.line-chart.name',
    description: 'Plot a numeric series against a label or date axis.',
    descriptionKey: 'pages.dashboard.plugins.line-chart.description',
    group: 'trend',
    component: LineChartPlugin,
    sample: { rows: MONTHLY_REVENUE, config: { xField: 'month', yField: 'revenue' } },
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
    group: 'compare',
    component: BarChartPlugin,
    sample: { rows: CHART_SAMPLE_DATA.products.slice(0, 5), config: { xField: 'product', yField: 'sales' } },
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
    group: 'kpi',
    component: StatCardPlugin,
    sample: { rows: [{ revenue: 128400, label: 'Revenue this month' }], config: { valueField: 'revenue', labelField: 'label', valueFormat: 'compact' } },
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
  },
  ...CHART_CATALOG.map(chart => catalogPlugin(chart))
]

export const DEFAULT_UI_PLUGINS: UIPluginDefinition[] = BASE_PLUGINS.map(plugin => ({
  ...plugin,
  inputSchema: [...plugin.inputSchema, ...(CHART_SETTINGS[plugin.id] ?? []).map(settingInput)]
}))

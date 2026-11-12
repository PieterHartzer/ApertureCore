import type { EChartsOption } from 'echarts'

import { applySeriesStyle, MAX_CATEGORICAL_SERIES, readableTextOn, type ChartColors } from './chart-colors'
import { applyAdvancedOptions, applyCartesianSettings, applyLabelOverridesToOption, type ValueFormatter } from './chart-settings'

export type ChartRow = Record<string, string | number | boolean | null>
export type ChartGroup = 'parts'
export interface ChartContext {
  rows: ChartRow[]
  config: Record<string, unknown>
  colors: ChartColors
  compact: boolean
  dense: boolean
  format: ValueFormatter
  labels: { other: string, total: string, increase: string, decrease: string, low: string, high: string }
}

export interface ChartInput {
  key: string
  required: boolean
  multiple?: boolean
  types: Array<'string' | 'number' | 'date'>
}

export interface ChartSample {
  dataset: keyof typeof CHART_SAMPLE_DATA
  config: Record<string, string | string[]>
}

export interface CatalogChart {
  id: string
  group: ChartGroup
  name: string
  description: string
  inputs: ChartInput[]
  sample: ChartSample
  build: (context: ChartContext) => EChartsOption | null
}

const LABEL = ['string', 'number', 'date'] as ChartInput['types']
const NUMBER = ['number'] as ChartInput['types']
const required = (key: string, types: ChartInput['types']): ChartInput => ({ key, required: true, types })
const toNumber = (value: unknown): number | null => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) return Number(value)
  return null
}
// Custom tooltip formatters are inserted as HTML, and these values come from query results.
const escapeHtml = (value: unknown) => String(value).replace(/[&<>"']/g, character => `&#${character.charCodeAt(0)};`)
const toLabel = (value: unknown) => value === null || value === undefined ? '' : String(value)
const field = (context: ChartContext, key: string) => typeof context.config[key] === 'string' ? context.config[key] : ''
const namedValues = (context: ChartContext, labelKey: string, valueKey: string) => {
  return context.rows.flatMap((row) => {
    const value = toNumber(row[valueKey])

    return value === null ? [] : [{ name: toLabel(row[labelKey]), value }]
  })
}

const foldedParts = (context: ChartContext) => {
  const parts = namedValues(context, field(context, 'labelField'), field(context, 'valueField')).filter(part => part.value > 0).sort((a, b) => b.value - a.value)

  if (parts.length <= MAX_CATEGORICAL_SERIES) return parts

  const kept = parts.slice(0, MAX_CATEGORICAL_SERIES - 1)
  const rest = parts.slice(MAX_CATEGORICAL_SERIES - 1).reduce((sum, part) => sum + part.value, 0)

  return [...kept, { name: context.labels.other, value: rest }]
}

const tooltip = (context: ChartContext, trigger: 'axis' | 'item' = 'axis') => ({
  trigger,
  ...(trigger === 'axis' ? { axisPointer: { type: 'line' as const, lineStyle: { color: context.colors.grid } } } : {}),
  confine: true,
  valueFormatter: (value: unknown) => typeof value === 'number' ? context.format.full(value) : toLabel(value),
  backgroundColor: context.colors.tooltipBackground,
  borderColor: context.colors.tooltipBorder,
  textStyle: { color: context.colors.tooltipText ?? context.colors.ink, fontSize: 12 }
})
const legend = (context: ChartContext, data?: string[]) => ({
  top: 0,
  type: 'scroll' as const,
  icon: 'roundRect',
  itemWidth: 10,
  itemHeight: 10,
  ...(data ? { data } : {}),
  textStyle: { color: context.colors.label, fontSize: 11 },
  pageTextStyle: { color: context.colors.label }
})
type SeriesOption = Record<string, unknown>

const base = (context: ChartContext) => ({ color: context.colors.categorical, animationDuration: 250 })

const sliceLabel = (context: ChartContext, count: number) => {
  const mode = context.config.labelMode
  const show = mode === 'name' || mode === 'percent' || mode === 'value' || (mode !== 'none' && !context.compact && count <= 4)
  const text = (item: { name: string, value: number, percent: number }) => mode === 'percent'
    ? `${item.name} ${item.percent}%`
    : mode === 'value' ? `${item.name} ${context.format.short(item.value)}` : item.name

  return { show, color: context.colors.label, fontSize: 11, formatter: text }
}

const pieChart = (seriesProps: SeriesOption, options: { centerTotal?: boolean } = {}) => (context: ChartContext): EChartsOption | null => {
  const parts = foldedParts(context)

  if (!parts.length) return null

  const total = parts.reduce((sum, part) => sum + part.value, 0)
  // A side legend fits every slice; beside a narrow chart it would squeeze the pie.
  const centerX = context.compact ? '50%' : '36%'
  const centerY = context.compact ? '56%' : '50%'
  const sideLegend = context.compact ? legend(context) : { ...legend(context), type: 'plain' as const, orient: 'vertical' as const, top: 'middle', left: undefined, right: 6 }

  return {
    ...base(context),
    tooltip: { ...tooltip(context, 'item'), formatter: (item: { name: string, value: number, percent: number }) => `${escapeHtml(item.name)}<br/><b>${escapeHtml(context.format.full(item.value))}</b> (${item.percent}%)` },
    legend: sideLegend,
    ...(options.centerTotal
      ? { title: { text: context.format.short(total), left: centerX, top: centerY, textAlign: 'center', textVerticalAlign: 'middle', textStyle: { color: context.colors.ink, fontSize: context.compact ? 16 : 22, fontWeight: 600 } } }
      : {}),
    series: [{
      type: 'pie',
      center: [centerX, centerY],
      data: parts,
      itemStyle: { borderColor: context.colors.surface, borderWidth: 2, borderRadius: 4 },
      label: sliceLabel(context, parts.length),
      labelLine: { lineStyle: { color: context.colors.grid } },
      ...seriesProps,
      ...(seriesProps.halfCircle ? { center: [centerX, '76%'], halfCircle: undefined } : {})
    }]
  } as EChartsOption
}

export const CHART_SAMPLE_DATA = {
  products: ([['Laptops', 44], ['Phones', 36], ['Tablets', 14], ['Licences', 52], ['Support', 21], ['Consulting', 30], ['Training', 12]] as [string, number][]).map(([product, sales]) => ({ product, sales }))
} satisfies Record<string, ChartRow[]>

const parts = (): ChartSample => ({ dataset: 'products', config: { labelField: 'product', valueField: 'sales' } })
const partInputs = [required('labelField', LABEL), required('valueField', NUMBER)]
export const CHART_CATALOG: CatalogChart[] = [
  { id: 'pie', group: 'parts', name: 'Pie chart', description: 'Parts of a whole.', build: pieChart({ radius: '68%' }), inputs: partInputs, sample: parts() }
]

/** Makes more charts available to CatalogChartPlugin. */
export const registerCatalogCharts = (charts: CatalogChart[]) => {
  for (const chart of charts) {
    if (!CHART_CATALOG.some(item => item.id === chart.id)) CHART_CATALOG.push(chart)
  }
}

export const buildChartOption = (chart: CatalogChart, context: ChartContext): EChartsOption | null => {
  const option = chart.build(context)

  return option ? applyAdvancedOptions(applyLabelOverridesToOption(applyCartesianSettings(applySeriesStyle(option, context.colors), context.config, context.format, context.colors), context.config), context.config) : null
}

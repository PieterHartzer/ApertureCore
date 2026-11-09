import { readFileSync } from 'node:fs'

import { init, use } from 'echarts/core'
import { SVGRenderer } from 'echarts/renderers'
import { afterEach, describe, expect, it, vi } from 'vitest'

import '../../../../app/utils/charts/register-echarts'
import { CHART_CATALOG, CHART_SAMPLE_DATA, type CatalogChart, type ChartContext } from '../../../../app/utils/charts/chart-catalog'
import { getChartColors, MAX_CATEGORICAL_SERIES } from '../../../../app/utils/charts/chart-colors'
import { createValueFormatter } from '../../../../app/utils/charts/chart-settings'

use(SVGRenderer)

const context = (chart: CatalogChart, overrides: Partial<ChartContext> = {}): ChartContext => ({
  rows: CHART_SAMPLE_DATA[chart.sample.dataset],
  config: chart.sample.config,
  colors: getChartColors(true),
  compact: false,
  dense: false,
  format: createValueFormatter({}, 'en'),
  labels: { other: 'Other', total: 'Total', increase: 'Increase', decrease: 'Decrease', low: 'Low', high: 'High' },
  ...overrides
})
const render = (chart: CatalogChart, overrides: Partial<ChartContext> = {}) => {
  const instance = init(null, undefined, { renderer: 'svg', ssr: true, width: 640, height: 320 })

  instance.setOption(chart.build!(context(chart, overrides))!)

  const svg = instance.renderToSVGString()

  instance.dispose()

  return svg
}
const drawn = CHART_CATALOG.filter(chart => chart.build)
const locale = JSON.parse(readFileSync('i18n/locales/en.json', 'utf8')).pages.dashboard.plugins

afterEach(() => vi.restoreAllMocks())

describe('chart catalogue', () => {
  it('adds the pie chart to the four original widgets', () => {
    expect(CHART_CATALOG.map(chart => chart.id)).toEqual(['pie'])
  })

  it.each(CHART_CATALOG.map(chart => [chart.id, chart] as const))('%s has translations and a sample that fills its required fields', (id, chart) => {
    expect(locale[id].name).toBe(chart.name)

    for (const input of chart.inputs) {
      expect(locale.catalog.fields[input.key], input.key).toBeTruthy()
      if (input.required) expect(chart.sample.config[input.key], input.key).toBeTruthy()
    }
  })

  it.each(drawn.map(chart => [chart.id, chart] as const))('%s renders with no ECharts errors', (_id, chart) => {
    const errors = vi.spyOn(console, 'error')
    const warnings = vi.spyOn(console, 'warn')

    expect(render(chart).length).toBeGreaterThan(800)
    expect(render(chart, { compact: true, dense: true, colors: getChartColors(false) }).length).toBeGreaterThan(200)
    expect(errors).not.toHaveBeenCalled()
    expect(warnings).not.toHaveBeenCalled()
  })

  it.each(drawn.map(chart => [chart.id, chart] as const))('%s reports no data instead of drawing an empty chart', (_id, chart) => {
    expect(chart.build!(context(chart, { rows: [] }))).toBeNull()
  })

  it.each(drawn.map(chart => [chart.id, chart] as const))('%s draws on one value axis', (_id, chart) => {
    const option = chart.build!(context(chart)) as { yAxis?: unknown, xAxis?: unknown }

    expect(Array.isArray(option.yAxis) && option.yAxis.length > 1).toBe(false)
    expect(Array.isArray(option.xAxis) && option.xAxis.length > 1).toBe(false)
  })
})

describe('chart data handling', () => {
  const pie = CHART_CATALOG.find(chart => chart.id === 'pie')!
  const rows = Array.from({ length: 12 }, (_, index) => ({ product: `P${index}`, sales: 100 - index }))

  it('folds parts beyond the palette into Other', () => {
    const option = pie.build!(context(pie, { rows })) as { series: { data: { name: string }[] }[] }

    expect(option.series[0]!.data).toHaveLength(MAX_CATEGORICAL_SERIES)
    expect(option.series[0]!.data.at(-1)!.name).toBe('Other')
  })

  it('accepts numbers returned as strings', () => {
    const option = pie.build!(context(pie, { rows: [{ product: 'A', sales: '12.5' }] })) as { series: { data: { value: number }[] }[] }

    expect(option.series[0]!.data[0]!.value).toBe(12.5)
  })

  it('escapes query values in tooltips', () => {
    const option = pie.build!(context(pie, { rows: [{ product: '<img src=x onerror=alert(1)>', sales: 1 }] })) as unknown as { tooltip: { formatter: (item: unknown) => string } }

    expect(option.tooltip.formatter({ name: '<img src=x onerror=alert(1)>', value: 1, percent: 100 })).not.toContain('<img')
  })

})

import { describe, expect, it } from 'vitest'

import { getChartColors } from '../../../../app/utils/charts/chart-colors'
import { applyCartesianSettings, applyColorSettings, getCardStyle, bandFor, bandStops, CHART_SETTINGS, colorSetting, createValueFormatter, getTextStyles, applyLabelOverridesToOption, applyLabelOverridesToRows, overrideLabel, parseAdvancedOptions, parseThresholdSteps, resolveBands, applyAdvancedOptions } from '../../../../app/utils/charts/chart-settings'
import { buildChartOption, CHART_CATALOG, CHART_SAMPLE_DATA, type CatalogChart } from '../../../../app/utils/charts/chart-catalog'

const format = (config: Record<string, unknown>) => createValueFormatter(config, 'en-US')

describe('value formatting', () => {
  it('shows currency with its symbol and two decimals', () => {
    expect(format({ valueFormat: 'currency', currency: 'USD' }).full(1234.5)).toBe('$1,234.50')
    expect(format({ valueFormat: 'currency', currency: 'ZAR' }).full(1234.5)).toMatch(/^R\s?1,234\.50$/)
  })

  it('uses compact amounts on axes', () => {
    expect(format({ valueFormat: 'currency', currency: 'USD' }).short(1_250_000)).toBe('$1.3M')
    expect(format({ valueFormat: 'compact' }).full(1500)).toBe('1.5K')
  })

  it('distinguishes percentages from fractions', () => {
    expect(format({ valueFormat: 'percent' }).full(42)).toBe('42%')
    expect(format({ valueFormat: 'fraction' }).full(0.42)).toBe('42%')
  })

  it('honours decimals, prefix and suffix', () => {
    expect(format({ valueFormat: 'number', decimals: 3 }).full(2)).toBe('2.000')
    expect(format({ prefix: '~', suffix: ' kg' }).full(5)).toBe('~5 kg')
    expect(format({ suffix: 'kg' }).full(5)).toBe('5 kg')
    expect(format({ suffix: '/mo' }).full(5)).toBe('5/mo')
  })

  it('survives out-of-range settings', () => {
    expect(format({ valueFormat: 'currency', currency: 'nope', decimals: 99 }).full(1)).toBe('$1.000000')
  })

  it('leaves unconfigured values as before', () => {
    expect(format({}).full(1234.567)).toBe('1,234.57')
  })
})

describe('colour steps', () => {
  const steps = (items: unknown) => ({ thresholds: JSON.stringify(items) })

  it('is off until a step has a value', () => {
    expect(resolveBands({})).toBeNull()
    expect(resolveBands(steps([{ from: null, color: '#123456' }]))).toBeNull()
  })

  it('applies the last step the value has reached, in value order', () => {
    const bands = resolveBands({ normalColor: '#000000', ...steps([{ from: 90, color: '#222222' }, { from: 70, color: '#111111' }]) })

    expect([50, 75, 95].map(value => bandFor(bands, value)?.color)).toEqual(['#000000', '#111111', '#222222'])
  })

  it('keeps at most five steps', () => {
    const six = Array.from({ length: 6 }, (_, from) => ({ from, color: '#123456' }))

    expect(parseThresholdSteps(steps(six))).toHaveLength(5)
  })

  it('ignores damaged settings and invalid colours', () => {
    expect(parseThresholdSteps({ thresholds: 'not json' })).toEqual([])
    expect(parseThresholdSteps(steps([{ from: 1, color: 'url(x)' }]))[0]!.color).toMatch(/^#[0-9a-f]{6}$/i)
  })

  it('builds gauge stops across the range', () => {
    expect(bandStops(resolveBands(steps([{ from: 50, color: '#111111' }, { from: 75, color: '#222222' }]))!, 0, 100).map(stop => stop[0])).toEqual([0.5, 0.75, 1])
  })
})

describe('colour settings', () => {
  it('rejects anything but hex colours', () => {
    expect(colorSetting({ color: 'url(https://example.com)' }, 'color')).toBeNull()
    expect(colorSetting({ color: '#AbCdEf' }, 'color')).toBe('#AbCdEf')
  })

  it('overrides only the first palette slot', () => {
    const colors = applyColorSettings(getChartColors(true), { color: '#112233' })

    expect(colors.categorical[0]).toBe('#112233')
    expect(colors.categorical[1]).toBe(getChartColors(true).categorical[1])
  })
})

describe('axis settings', () => {
  const base = { xAxis: { type: 'category' }, yAxis: { type: 'value' }, series: [{ type: 'line', silent: true }, { type: 'bar', name: 'a' }] }
  const apply = (config: Record<string, unknown>) => applyCartesianSettings(base, config, format({}), getChartColors(true)) as unknown as { yAxis: { min?: number, max?: number }, series: { markLine?: unknown, label?: unknown }[] }

  it('sets axis limits', () => {
    expect(apply({ axisMin: 10, axisMax: 90 }).yAxis).toMatchObject({ min: 10, max: 90 })
  })

  it('draws the target line on the first visible series only', () => {
    const { series } = apply({ referenceValue: 50 })

    expect(series[0]!.markLine).toBeUndefined()
    expect(series[1]!.markLine).toBeDefined()
  })

  it('returns untouched options when nothing is configured', () => {
    expect(applyCartesianSettings(base, {}, format({}), getChartColors(true))).toEqual(base)
  })
})

describe('settings catalogue', () => {
  const context = (chart: CatalogChart, config: Record<string, unknown>) => ({
    rows: CHART_SAMPLE_DATA[chart.sample.dataset],
    config: { ...chart.sample.config, ...config },
    colors: getChartColors(true),
    compact: false,
    dense: false,
    format: format(config),
    labels: { other: 'Other', total: 'Total', increase: 'Up', decrease: 'Down', low: 'Low', high: 'High' }
  })

  it('offers ECharts options on every chart ECharts draws', () => {
    const drawn = CHART_CATALOG.filter(chart => chart.build).map(chart => chart.id)

    expect(drawn.filter(id => !CHART_SETTINGS[id]?.some(setting => setting.key === 'advancedOptions'))).toEqual([])
  })

})

describe('advanced options', () => {
  const advanced = (value: unknown) => ({ advancedOptions: JSON.stringify(value) })

  it('merges over the built chart and keeps its data', () => {
    const base = { series: [{ type: 'bar', data: [1, 2] }], tooltip: { trigger: 'axis' } }

    expect(applyAdvancedOptions(base, advanced({ series: [{ barWidth: 10 }], dataZoom: [{ type: 'slider' }], tooltip: { confine: false } }))).toEqual({
      series: [{ type: 'bar', data: [1, 2], barWidth: 10 }],
      tooltip: { trigger: 'axis', confine: false },
      dataZoom: [{ type: 'slider' }]
    })
  })

  it('flags invalid JSON and ignores it', () => {
    const base = { series: [] }

    expect(parseAdvancedOptions({ advancedOptions: '{ nope' })).toEqual({ options: null, invalid: true })
    expect(parseAdvancedOptions({ advancedOptions: '[1]' }).invalid).toBe(true)
    expect(applyAdvancedOptions(base, { advancedOptions: '{ nope' })).toBe(base)
  })

  it('drops unknown component types that would stop the chart drawing', () => {
    const { options } = parseAdvancedOptions(advanced({ xAxis: { type: 'nonsense', name: 'x' }, visualMap: { type: 'nope' }, dataZoom: [{ type: 'slider' }, { type: 'bad' }] }))

    expect(options).toEqual({ xAxis: { name: 'x' }, visualMap: {}, dataZoom: [{ type: 'slider' }, {}] })
  })

  it('removes markup, outside content and prototype keys', () => {
    const { options } = parseAdvancedOptions({ advancedOptions: '{"tooltip":{"formatter":"<img src=x onerror=alert(1)>","extraCssText":"color:red","confine":true},"series":[{"symbol":"image://https://evil.example/a.png","type":"pie","name":"ok"}],"backgroundColor":{"image":"x"},"graphic":[{}],"__proto__":{"polluted":true}}' })

    expect(options).toEqual({ tooltip: { confine: true }, series: [{ name: 'ok' }], backgroundColor: {} })
    expect(({} as { polluted?: boolean }).polluted).toBeUndefined()
  })
})

describe('label overrides', () => {
  const config = { labelOverrides: JSON.stringify([{ from: 'term_a', to: 'Field A' }, { from: 'sales', to: 'Revenue' }, { from: 'blank', to: '' }]) }

  it('replaces exact text matches in rows only', () => {
    expect(applyLabelOverridesToRows([{ name: 'term_a', other: 'term_a2', sales: 5, note: 'blank' }], config)).toEqual([{ name: 'Field A', other: 'term_a2', sales: 5, note: 'blank' }])
  })

  it('renames series and legend entries', () => {
    expect(applyLabelOverridesToOption({ series: [{ type: 'bar', name: 'sales' }], legend: { data: ['sales'] } }, config)).toEqual({ series: [{ type: 'bar', name: 'Revenue' }], legend: { data: ['Revenue'] } })
  })

  it('renames table columns', () => {
    expect(overrideLabel(config, 'sales')).toBe('Revenue')
    expect(overrideLabel(config, 'other')).toBe('other')
  })

  it('tolerates damaged settings', () => {
    expect(applyLabelOverridesToRows([{ a: 'x' }], { labelOverrides: 'not json' })).toEqual([{ a: 'x' }])
  })
})

describe('text styles', () => {
  it('is empty until something is set', () => {
    expect(getTextStyles({})).toEqual({ horizontal: {}, container: {}, value: {}, label: {}, table: {} })
  })

  it('maps alignment and clamps sizes', () => {
    const styles = getTextStyles({ textAlign: 'center', verticalAlign: 'top', valueFontSize: 999, labelFontSize: 1 })

    expect(styles.container).toEqual({ alignItems: 'center', textAlign: 'center', justifyContent: 'flex-start' })
    expect(styles.value.fontSize).toBe('120px !important')
    expect(styles.label.fontSize).toBe('10px !important')
  })

  it('ignores unknown alignments', () => {
    expect(getTextStyles({ textAlign: 'url(x)', verticalAlign: 'x' }).container).toEqual({})
  })

  it('offers text settings on text widgets only', () => {
    expect(CHART_SETTINGS['stat-card']!.map(item => item.key)).toEqual(expect.arrayContaining(['valueFontSize', 'labelFontSize', 'textAlign', 'verticalAlign']))
    expect(CHART_SETTINGS.pie!.some(item => item.section === 'text')).toBe(false)
  })
})

describe('widget card style', () => {
  it('is empty when the widget sets nothing', () => {
    expect(getCardStyle({})).toEqual({})
  })

  it('applies background, border and corners, winning over the dashboard', () => {
    expect(getCardStyle({ cardBackground: '#11223380', cardBorderColor: '#ff0000', cardBorderWidth: 3, cardBorderStyle: 'dotted', cardRadius: 12 })).toEqual({
      backgroundColor: '#11223380 !important',
      outline: '3px dotted #ff0000 !important',
      outlineOffset: '-3px !important',
      borderRadius: '12px !important'
    })
  })

  it('never passes unsafe values into styles', () => {
    expect(getCardStyle({ cardBackground: 'url(x)', cardBorderStyle: 'groove', cardBorderWidth: 99, cardRadius: -5 })).toEqual({
      outline: '8px solid var(--ui-border) !important',
      outlineOffset: '-8px !important',
      borderRadius: '0px !important'
    })
  })
})

describe('target line style', () => {
  it('uses the chosen colour and line style', () => {
    const option = applyCartesianSettings(
      { xAxis: { type: 'category' }, yAxis: { type: 'value' }, series: [{ type: 'bar', data: [1] }] },
      { referenceValue: 5, referenceColor: '#00ff0080', referenceLineStyle: 'solid' },
      format({}),
      getChartColors('light')
    ) as { series: Array<{ markLine?: { lineStyle: Record<string, unknown> } }> }

    expect(option.series[0]?.markLine?.lineStyle).toMatchObject({ color: '#00ff0080', type: 'solid' })
  })
})

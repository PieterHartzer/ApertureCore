import { describe, expect, it } from 'vitest'

import type { PluginInputDefinition, UIPluginFieldOption } from '../../../../app/types/uiPlugin'
import {
  autoMapFields,
  describeResultShape,
  registerChartSuggestions,
  suggestCharts
} from '../../../../app/utils/charts/chart-suggestions'

const CORE = ['stat-card', 'line-chart', 'bar-chart', 'pie', 'table']

const field = (value: string, fieldType: UIPluginFieldOption['fieldType']): UIPluginFieldOption => ({ label: value, value, fieldType })
const input = (key: string, types: PluginInputDefinition['compatibleFieldTypes'], extra: Partial<PluginInputDefinition> = {}): PluginInputDefinition => ({
  key,
  label: key,
  type: 'string',
  required: true,
  compatibleFieldTypes: types,
  ...extra
})
const rows = (count: number, make: (index: number) => Record<string, unknown>) => Array.from({ length: count }, (_, index) => make(index))
const suggest = (fields: UIPluginFieldOption[], data: Array<Record<string, unknown>>, available = CORE) => suggestCharts(describeResultShape(fields, data), available)

describe('suggestCharts', () => {
  it('suggests a stat card for a single number', () => {
    expect(suggest([field('total', 'number')], [{ total: 12 }])[0]).toBe('stat-card')
  })

  it('suggests a line chart for numbers over dates', () => {
    const data = rows(12, index => ({ month: `2026-${String(index + 1).padStart(2, '0')}-01`, revenue: index }))

    expect(suggest([field('month', 'date'), field('revenue', 'number')], data)[0]).toBe('line-chart')
  })

  it('suggests a pie for a few categories and bars for more', () => {
    const fields = [field('region', 'string'), field('sales', 'number')]

    expect(suggest(fields, rows(4, index => ({ region: `R${index}`, sales: index })))[0]).toBe('pie')
    expect(suggest(fields, rows(10, index => ({ region: `R${index}`, sales: index })))[0]).toBe('bar-chart')
  })

  it('falls back to a table when nothing else fits', () => {
    expect(suggest([field('name', 'string'), field('email', 'string')], [{ name: 'A', email: 'a@b' }])).toEqual(['table'])
  })

  it('suggests nothing for an empty result', () => {
    expect(suggest([field('total', 'number')], [])).toEqual([])
  })

  it('leaves out widgets that are not available', () => {
    const data = rows(12, index => ({ month: `2026-${String(index + 1).padStart(2, '0')}-01`, revenue: index }))

    expect(suggest([field('month', 'date'), field('revenue', 'number')], data, ['bar-chart', 'table'])).toEqual(['bar-chart', 'table'])
  })

  it('ranks widgets a layer registers', () => {
    registerChartSuggestions([{ pluginId: 'test-only-widget', score: shape => shape.rowCount === 1 ? 99 : 0 }])

    expect(suggest([field('total', 'number')], [{ total: 1 }], [...CORE, 'test-only-widget'])[0]).toBe('test-only-widget')
  })
})

describe('autoMapFields', () => {
  it('puts dates on the axis and numbers in the value', () => {
    const inputs = [input('xField', ['string', 'number', 'date']), input('yField', ['number'])]
    const fields = [field('revenue', 'number'), field('month', 'date')]

    expect(autoMapFields(inputs, fields, {})).toEqual({ xField: 'month', yField: 'revenue' })
  })

  it('keeps choices that were already made', () => {
    const inputs = [input('xField', ['string', 'number', 'date']), input('yField', ['number'])]
    const fields = [field('month', 'date'), field('revenue', 'number'), field('costs', 'number')]

    expect(autoMapFields(inputs, fields, { yField: 'costs' })).toEqual({ xField: 'month', yField: 'costs' })
  })

  it('does not let a label take the only number a value needs', () => {
    const inputs = [input('xField', ['string', 'number', 'date']), input('yField', ['number'])]

    expect(autoMapFields(inputs, [field('total', 'number')], {})).toEqual({ yField: 'total' })
  })

  it('uses two numbers when the label may be a number', () => {
    const inputs = [input('xField', ['string', 'number', 'date']), input('yField', ['number'])]

    expect(autoMapFields(inputs, [field('year', 'number'), field('sales', 'number')], {})).toEqual({ xField: 'year', yField: 'sales' })
  })

  it('fills a multiple choice with every remaining number', () => {
    const inputs = [input('xField', ['date', 'string']), input('yFields', ['number'], { selectionMode: 'multiple' })]
    const fields = [field('month', 'date'), field('revenue', 'number'), field('costs', 'number')]

    expect(autoMapFields(inputs, fields, {})).toEqual({ xField: 'month', yFields: ['revenue', 'costs'] })
  })

  it('leaves optional inputs and settings alone', () => {
    const inputs = [input('valueField', ['number']), input('labelField', ['string'], { required: false }), input('color', undefined, { source: 'value' })]

    expect(autoMapFields(inputs, [field('total', 'number'), field('name', 'string')], { color: '#fff' })).toEqual({ valueField: 'total', color: '#fff' })
  })
})

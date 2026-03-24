import { describe, expect, it } from 'vitest'

import {
  buildUIPluginFieldOptions,
  filterUIPluginFieldOptions,
  inferUIPluginFieldType
} from '../../../app/types/uiPlugin'

describe('uiPlugin helpers', () => {
  it('infers field types from query result rows', () => {
    const rows = [{
      created_at: '2026-03-24T08:15:00Z',
      sales_total: 4200,
      region: 'EMEA',
      active: true,
      empty_column: null
    }]

    expect(inferUIPluginFieldType('created_at', rows)).toBe('date')
    expect(inferUIPluginFieldType('sales_total', rows)).toBe('number')
    expect(inferUIPluginFieldType('region', rows)).toBe('string')
    expect(inferUIPluginFieldType('active', rows)).toBe('boolean')
    expect(inferUIPluginFieldType('empty_column', rows)).toBe('unknown')
  })

  it('builds field options and filters them by compatible field types', () => {
    const fieldOptions = buildUIPluginFieldOptions(
      ['created_at', 'sales_total', 'region', 'empty_column'],
      [{
        created_at: '2026-03-24',
        sales_total: 99,
        region: 'North',
        empty_column: null
      }]
    )

    expect(fieldOptions).toEqual([
      {
        label: 'created_at',
        value: 'created_at',
        fieldType: 'date'
      },
      {
        label: 'sales_total',
        value: 'sales_total',
        fieldType: 'number'
      },
      {
        label: 'region',
        value: 'region',
        fieldType: 'string'
      },
      {
        label: 'empty_column',
        value: 'empty_column',
        fieldType: 'unknown'
      }
    ])

    expect(filterUIPluginFieldOptions({
      key: 'yField',
      label: 'Y axis field',
      type: 'string',
      required: true,
      compatibleFieldTypes: ['number']
    }, fieldOptions)).toEqual([
      {
        label: 'sales_total',
        value: 'sales_total',
        fieldType: 'number'
      },
      {
        label: 'empty_column',
        value: 'empty_column',
        fieldType: 'unknown'
      }
    ])
  })
})

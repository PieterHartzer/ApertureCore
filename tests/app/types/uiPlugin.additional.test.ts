import { describe, expect, it } from 'vitest'

import {
  filterUIPluginFieldOptions,
  inferUIPluginFieldType
} from '../../../app/types/uiPlugin'

describe('uiPlugin helpers additional coverage', () => {
  it('falls back to string for mixed non-null field types', () => {
    expect(inferUIPluginFieldType('value', [
      { value: 42 },
      { value: 'forty-two' }
    ])).toBe('string')

    expect(inferUIPluginFieldType('value', [
      { value: '2026-03-24' },
      { value: false }
    ])).toBe('string')
  })

  it('returns all field options when no compatibility filter is defined', () => {
    const fieldOptions = [
      {
        label: 'day',
        value: 'day',
        fieldType: 'date' as const
      },
      {
        label: 'sales_total',
        value: 'sales_total',
        fieldType: 'number' as const
      }
    ]

    expect(filterUIPluginFieldOptions({
      key: 'xField',
      label: 'X axis field',
      type: 'string'
    }, fieldOptions)).toEqual(fieldOptions)
  })
})

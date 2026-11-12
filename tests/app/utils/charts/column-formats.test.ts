import { describe, expect, it } from 'vitest'

import {
  applyColumnFormatsToRows,
  applyTextCase,
  formatDatePattern,
  formatDateValue,
  numberFormatterFor,
  parseColumnFormats,
  previewColumnFormat,
  valueColumnOf
} from '../../../../app/utils/charts/column-formats'

const config = (formats: unknown, extra: Record<string, unknown> = {}) => ({ columnFormats: JSON.stringify(formats), ...extra })

describe('column formats', () => {
  it('keeps only valid rules and clamps their options', () => {
    expect(parseColumnFormats(config([
      { column: 'revenue', kind: 'currency', currency: 'ZAR', decimals: 9 },
      { column: 'day', kind: 'date', dateStyle: 'long' },
      { column: 'bad', kind: 'sparkles' },
      { kind: 'number' },
      { column: 'code', kind: 'currency', currency: 'rand' }
    ]))).toEqual([
      { column: 'revenue', kind: 'currency', currency: 'ZAR', decimals: 6 },
      { column: 'day', kind: 'date', dateStyle: 'long' },
      { column: 'code', kind: 'currency' }
    ])
    expect(parseColumnFormats({ columnFormats: 'not json' })).toEqual([])
  })

  it('gives each column its own number format, falling back to the widget format', () => {
    const settings = config([{ column: 'revenue', kind: 'currency', currency: 'EUR', decimals: 0 }, { column: 'share', kind: 'fraction' }], { valueFormat: 'compact' })

    expect(numberFormatterFor(settings, 'en', 'revenue').full(1234.5)).toBe('€1,235')
    expect(numberFormatterFor(settings, 'en', 'share').full(0.42)).toBe('42%')
    expect(numberFormatterFor(settings, 'en', 'visits').full(12_500)).toBe('12.5K')
  })

  it('formats dates in the viewer\'s language, keeping a date-only value on its own day', () => {
    expect(formatDateValue('2026-08-15', { kind: 'date', dateStyle: 'medium' }, 'en-US')).toBe('Aug 15, 2026')
    expect(formatDateValue('2026-08-15', { kind: 'date', dateStyle: 'long' }, 'en-GB')).toBe('15 August 2026')
    expect(formatDateValue('2026-08-15', { kind: 'date', dateStyle: 'iso' }, 'en')).toBe('2026-08-15')
    expect(formatDateValue('2026-08-15', { kind: 'month' }, 'en')).toBe('Aug 2026')
    expect(formatDateValue('2026-08-15', { kind: 'year' }, 'en')).toBe('2026')
  })

  it('says how long ago a date was', () => {
    const now = new Date('2026-11-11T12:00:00Z')

    expect(formatDateValue('2026-11-08T12:00:00Z', { kind: 'relative' }, 'en', now)).toBe('3 days ago')
    expect(formatDateValue('2026-11-11T11:00:00Z', { kind: 'relative' }, 'en', now)).toBe('1 hour ago')
  })

  it('leaves values that are not dates as they are', () => {
    expect(formatDateValue('pending', { kind: 'date' }, 'en')).toBe('pending')
    expect(formatDateValue(null, { kind: 'date' }, 'en')).toBe('')
  })

  it('formats date columns in rows, except those a chart needs as real dates', () => {
    const rows = [{ day: '2026-08-15', total: 4, label: 'a' }]
    const settings = config([{ column: 'day', kind: 'date', dateStyle: 'iso' }, { column: 'total', kind: 'number' }])

    expect(applyColumnFormatsToRows(rows, { columnFormats: JSON.stringify([{ column: 'day', kind: 'month' }]) }, 'en')).toEqual([{ day: 'Aug 2026', total: 4, label: 'a' }])
    expect(applyColumnFormatsToRows(rows, settings, 'en', new Set(['day']))).toBe(rows)
  })

  it('takes a chart\'s numbers from its first number-only setting', () => {
    const inputs = [{ key: 'xField', types: ['string', 'date'] }, { key: 'yFields', types: ['number'] }]

    expect(valueColumnOf(inputs, { xField: 'day', yFields: ['revenue', 'cost'] })).toBe('revenue')
    expect(valueColumnOf(inputs, { xField: 'day' })).toBeUndefined()
  })

  it('lays dates out by a fixed pattern, the same for every viewer', () => {
    const date = new Date(Date.UTC(2026, 7, 5, 14, 7, 9))

    expect(formatDatePattern(date, 'DD/MM/YYYY HH:mm:ss', 'en-US', true)).toBe('05/08/2026 14:07:09')
    expect(formatDatePattern(date, 'MM/DD/YY h:mm A', 'en-GB', true)).toBe('08/05/26 2:07 PM')
    expect(formatDatePattern(date, 'dddd, Do MMMM [at] H[h]mm', 'en', true)).toBe('Wednesday, 5th August at 14h07')
    expect(formatDateValue('2026-08-15', { kind: 'date', dateStyle: 'pattern', pattern: 'D MMM YYYY' }, 'en-US')).toBe('15 Aug 2026')
    expect(formatDateValue('2026-08-15', { kind: 'datetime', dateStyle: 'pattern' }, 'en')).toBe('15/08/2026 00:00')
  })

  it('changes the letter case of text, leaving numbers alone', () => {
    expect(applyTextCase('hello WORLD of-data', 'title', 'en')).toBe('Hello World Of-Data')
    expect(applyTextCase('Mixed', 'upper', 'en')).toBe('MIXED')
    expect(applyTextCase('Mixed', 'lower', 'en')).toBe('mixed')

    const settings = config([{ column: 'name', kind: 'text', textCase: 'upper' }, { column: 'total', kind: 'text', textCase: 'upper' }])

    expect(applyColumnFormatsToRows([{ name: 'ann', total: 4 }], settings, 'en')).toEqual([{ name: 'ANN', total: 4 }])
  })

  it('previews a format with a sample value', () => {
    expect(previewColumnFormat('2026-08-15', { column: 'day', kind: 'date', dateStyle: 'pattern', pattern: 'YYYY/MM/DD' }, 'en')).toBe('2026/08/15')
    expect(previewColumnFormat('12.5', { column: 'price', kind: 'currency', currency: 'USD', decimals: 2 }, 'en')).toBe('$12.50')
    expect(previewColumnFormat('ann lee', { column: 'name', kind: 'text', textCase: 'title' }, 'en')).toBe('Ann Lee')
  })
})

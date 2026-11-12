import { createValueFormatter, type ValueFormatter } from './chart-settings'

/**
 * Per-column formatting: a list the widget builder edits, saved as one JSON
 * string because widget settings hold plain values only. A column's own rule
 * wins over the widget's general number format.
 */

export const NUMBER_FORMAT_KINDS = ['number', 'compact', 'currency', 'percent', 'fraction'] as const
export const DATE_FORMAT_KINDS = ['date', 'datetime', 'time', 'month', 'year', 'relative'] as const
export const COLUMN_FORMAT_KINDS = [...NUMBER_FORMAT_KINDS, ...DATE_FORMAT_KINDS, 'text'] as const
// 'pattern' shows every viewer the same fixed layout, such as DD/MM/YYYY; the others follow each viewer's language.
export const DATE_STYLES = ['short', 'medium', 'long', 'iso', 'pattern'] as const
export const TEXT_CASES = ['upper', 'lower', 'title'] as const
export const MAX_DATE_PATTERN_LENGTH = 64

/** Fixed layouts offered in the builder, using the same letters as VueUse's useDateFormat. */
export const DATE_PATTERN_PRESETS = [
  'YYYY-MM-DD',
  'DD/MM/YYYY',
  'MM/DD/YYYY',
  'D MMM YYYY',
  'MMM D, YYYY',
  'dddd, D MMMM YYYY',
  'DD/MM/YYYY HH:mm',
  'YYYY-MM-DD HH:mm',
  'MMM YYYY',
  'HH:mm',
  'h:mm A'
] as const

export type ColumnFormatKind = typeof COLUMN_FORMAT_KINDS[number]
export type DateStyle = typeof DATE_STYLES[number]
export type TextCase = typeof TEXT_CASES[number]

export interface ColumnFormat {
  column: string
  kind: ColumnFormatKind
  decimals?: number
  currency?: string
  dateStyle?: DateStyle
  pattern?: string
  textCase?: TextCase
}

export const MAX_COLUMN_FORMATS = 50

type Config = Record<string, unknown>

const isKind = (value: unknown): value is ColumnFormatKind => (COLUMN_FORMAT_KINDS as readonly string[]).includes(String(value))

export const isNumberKind = (kind: ColumnFormatKind) => (NUMBER_FORMAT_KINDS as readonly string[]).includes(kind)
export const isDateKind = (kind: ColumnFormatKind) => (DATE_FORMAT_KINDS as readonly string[]).includes(kind)

export const parseColumnFormats = (config: Config): ColumnFormat[] => {
  try {
    const parsed: unknown = JSON.parse(typeof config.columnFormats === 'string' && config.columnFormats ? config.columnFormats : '[]')

    if (!Array.isArray(parsed)) return []

    return parsed.slice(0, MAX_COLUMN_FORMATS).flatMap((item: Record<string, unknown>) => {
      if (typeof item?.column !== 'string' || !isKind(item.kind)) return []

      const decimals = typeof item.decimals === 'number' && Number.isFinite(item.decimals) ? Math.min(Math.max(Math.trunc(item.decimals), 0), 6) : undefined
      const currency = typeof item.currency === 'string' && /^[A-Z]{3}$/.test(item.currency) ? item.currency : undefined
      const dateStyle = (DATE_STYLES as readonly string[]).includes(String(item.dateStyle)) ? item.dateStyle as DateStyle : undefined
      const pattern = typeof item.pattern === 'string' && item.pattern.trim() ? item.pattern.slice(0, MAX_DATE_PATTERN_LENGTH) : undefined
      const textCase = (TEXT_CASES as readonly string[]).includes(String(item.textCase)) ? item.textCase as TextCase : undefined

      return [{
        column: item.column.slice(0, 200),
        kind: item.kind,
        ...(decimals !== undefined ? { decimals } : {}),
        ...(currency ? { currency } : {}),
        ...(dateStyle ? { dateStyle } : {}),
        ...(pattern ? { pattern } : {}),
        ...(textCase ? { textCase } : {})
      }]
    })
  } catch {
    return []
  }
}

export const findColumnFormat = (config: Config, column: string | undefined) => {
  return column ? parseColumnFormats(config).find(format => format.column === column) : undefined
}

/** The pattern a column starts with when someone switches it to a fixed pattern. */
export const defaultDatePattern = (kind: ColumnFormatKind) => {
  switch (kind) {
    case 'datetime': return 'DD/MM/YYYY HH:mm'
    case 'time': return 'HH:mm'
    case 'month': return 'MMM YYYY'
    case 'year': return 'YYYY'
    default: return 'DD/MM/YYYY'
  }
}

// A date with no time means that calendar day wherever the viewer is.
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

const toDate = (value: unknown) => {
  if (value instanceof Date) return value
  if (typeof value === 'number') return new Date(value)
  if (typeof value !== 'string' || !value.trim()) return null

  const date = new Date(DATE_ONLY.test(value.trim()) ? `${value.trim()}T00:00:00Z` : value)

  return Number.isNaN(date.getTime()) ? null : date
}

const RELATIVE_UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ['year', 31_536_000_000],
  ['month', 2_592_000_000],
  ['week', 604_800_000],
  ['day', 86_400_000],
  ['hour', 3_600_000],
  ['minute', 60_000],
  ['second', 1000]
]

const PATTERN_TOKENS = /\[([^\]]*)\]|YYYY|YY|MMMM|MMM|MM|M|Do|DD|D|dddd|ddd|dd|d|HH|H|hh|h|mm|m|ss|s|SSS|A|a/g
const pad = (value: number, length = 2) => String(value).padStart(length, '0')
const englishOrdinal = (day: number) => {
  const suffix = day % 100 >= 11 && day % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][day % 10] ?? 'th'

  return `${day}${suffix}`
}

/**
 * Lays a date out by a fixed pattern, such as DD/MM/YYYY, using the letters
 * VueUse's useDateFormat understands. Text in [brackets] is kept as it is.
 * Month and day names still follow the viewer's language.
 */
export const formatDatePattern = (date: Date, pattern: string, locale: string, utc = false) => {
  const timeZone = utc ? 'UTC' : undefined
  const year = utc ? date.getUTCFullYear() : date.getFullYear()
  const month = utc ? date.getUTCMonth() : date.getMonth()
  const day = utc ? date.getUTCDate() : date.getDate()
  const weekday = utc ? date.getUTCDay() : date.getDay()
  const hours = utc ? date.getUTCHours() : date.getHours()
  const minutes = utc ? date.getUTCMinutes() : date.getMinutes()
  const seconds = utc ? date.getUTCSeconds() : date.getSeconds()
  const milliseconds = utc ? date.getUTCMilliseconds() : date.getMilliseconds()
  const name = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale, { ...options, timeZone }).format(date)

  return pattern.slice(0, MAX_DATE_PATTERN_LENGTH).replace(PATTERN_TOKENS, (token, literal: string | undefined) => {
    if (literal !== undefined) return literal

    switch (token) {
      case 'YYYY': return pad(year, 4)
      case 'YY': return pad(year % 100)
      case 'MMMM': return name({ month: 'long' })
      case 'MMM': return name({ month: 'short' })
      case 'MM': return pad(month + 1)
      case 'M': return String(month + 1)
      case 'Do': return locale.startsWith('en') ? englishOrdinal(day) : `${day}.`
      case 'DD': return pad(day)
      case 'D': return String(day)
      case 'dddd': return name({ weekday: 'long' })
      case 'ddd': return name({ weekday: 'short' })
      case 'dd': return name({ weekday: 'narrow' })
      case 'd': return String(weekday)
      case 'HH': return pad(hours)
      case 'H': return String(hours)
      case 'hh': return pad(hours % 12 || 12)
      case 'h': return String(hours % 12 || 12)
      case 'mm': return pad(minutes)
      case 'm': return String(minutes)
      case 'ss': return pad(seconds)
      case 's': return String(seconds)
      case 'SSS': return pad(milliseconds, 3)
      case 'A': return hours < 12 ? 'AM' : 'PM'
      case 'a': return hours < 12 ? 'am' : 'pm'
      default: return token
    }
  })
}

/** Text in upper, lower or title case. Title case capitalises the first letter of each word. */
export const applyTextCase = (value: string, textCase: TextCase | undefined, locale: string) => {
  switch (textCase) {
    case 'upper': return value.toLocaleUpperCase(locale)
    case 'lower': return value.toLocaleLowerCase(locale)
    case 'title': return value.toLocaleLowerCase(locale).replace(/(^|[\s\-_/(\[{"'])(\p{L})/gu, (_, before: string, letter: string) => before + letter.toLocaleUpperCase(locale))
    default: return value
  }
}

/** A date or time as text for the viewer's language, or the value as it was when it isn't a date. */
export const formatDateValue = (value: unknown, format: Pick<ColumnFormat, 'kind' | 'dateStyle' | 'pattern'>, locale: string, now = new Date()): string => {
  const date = toDate(value)

  if (!date) return value === null || value === undefined ? '' : String(value)

  const dateOnly = typeof value === 'string' && DATE_ONLY.test(value.trim())
  const timeZone = dateOnly ? 'UTC' : undefined
  const style = format.dateStyle ?? 'medium'
  const dateStyle = style === 'iso' || style === 'pattern' ? 'medium' : style

  try {
    if (style === 'pattern' && format.kind !== 'relative') {
      return formatDatePattern(date, format.pattern || defaultDatePattern(format.kind), locale, dateOnly)
    }

    switch (format.kind) {
      case 'date':
        return style === 'iso'
          ? date.toISOString().slice(0, 10)
          : new Intl.DateTimeFormat(locale, { dateStyle, timeZone }).format(date)
      case 'datetime':
        return style === 'iso'
          ? date.toISOString().slice(0, 16).replace('T', ' ')
          : new Intl.DateTimeFormat(locale, { dateStyle, timeStyle: 'short', timeZone }).format(date)
      case 'time':
        return new Intl.DateTimeFormat(locale, { timeStyle: 'short', timeZone }).format(date)
      case 'month':
        return new Intl.DateTimeFormat(locale, { month: style === 'long' ? 'long' : 'short', year: 'numeric', timeZone }).format(date)
      case 'year':
        return new Intl.DateTimeFormat(locale, { year: 'numeric', timeZone }).format(date)
      case 'relative': {
        const difference = date.getTime() - now.getTime()
        const [unit, size] = RELATIVE_UNITS.find(([, length]) => Math.abs(difference) >= length) ?? ['second', 1000]

        return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(Math.round(difference / size), unit)
      }
      default:
        return String(value)
    }
  } catch {
    return String(value)
  }
}

/** The number formatter for a column: its own rule, otherwise the widget's general format. */
export const numberFormatterFor = (config: Config, locale: string, column?: string): ValueFormatter => {
  const format = findColumnFormat(config, column)

  if (!format || !isNumberKind(format.kind)) return createValueFormatter(config, locale)

  return createValueFormatter({
    ...config,
    valueFormat: format.kind,
    decimals: format.decimals ?? null,
    ...(format.currency ? { currency: format.currency } : {})
  }, locale)
}

/**
 * Formats date and text columns in the rows before a widget draws them.
 * Columns a chart needs as real dates (for a time axis or calendar) are left
 * as they are. Text case changes only text, so numbers stay numbers.
 */
export const applyColumnFormatsToRows = <T extends Record<string, unknown>>(rows: T[], config: Config, locale: string, keepAsDates: ReadonlySet<string> = new Set()): T[] => {
  const formats = parseColumnFormats(config).filter(format => (isDateKind(format.kind) && !keepAsDates.has(format.column)) || (format.kind === 'text' && format.textCase))

  if (!formats.length) return rows

  const now = new Date()

  return rows.map((row) => {
    const next: Record<string, unknown> = { ...row }

    for (const format of formats) {
      const value = next[format.column]

      if (!(format.column in next) || value === null) continue

      if (format.kind === 'text') {
        if (typeof value === 'string') next[format.column] = applyTextCase(value, format.textCase, locale)
      } else {
        next[format.column] = formatDateValue(value, format, locale, now)
      }
    }

    return next as T
  })
}

/** How one value looks with a column's format, for the builder's preview. */
export const previewColumnFormat = (value: unknown, format: ColumnFormat, locale: string, now = new Date()) => {
  if (isDateKind(format.kind)) return formatDateValue(value ?? now.toISOString(), format, locale, now)

  if (isNumberKind(format.kind)) {
    const number = typeof value === 'number' ? value : Number(value)

    return numberFormatterFor({ columnFormats: JSON.stringify([format]) }, locale, format.column).full(Number.isFinite(number) && value !== null && value !== '' ? number : 1234.5)
  }

  return applyTextCase(value === null || value === undefined ? '' : String(value), format.textCase, locale)
}

/** The column a chart's numbers come from: the first setting that accepts numbers only. */
export const valueColumnOf = (inputs: Array<{ key: string, types?: readonly string[], compatibleFieldTypes?: readonly string[] }>, config: Config) => {
  for (const input of inputs) {
    const types = input.types ?? input.compatibleFieldTypes

    if (types?.length !== 1 || types[0] !== 'number') continue

    const value = config[input.key]
    const column = Array.isArray(value) ? value[0] : value

    if (typeof column === 'string' && column) return column
  }

  return undefined
}

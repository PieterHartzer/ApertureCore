import type { ChartColors } from './chart-colors'
import { BORDER_STYLES, isBorderStyle, outlineDeclarations } from '#shared/utils/border'
import { isHexColor } from '#shared/utils/color'

export type SettingControl = 'number' | 'text' | 'textarea' | 'color' | 'select' | 'switch' | 'thresholds' | 'json' | 'labels'
export type SettingSpan = 'full' | 'half' | 'third'
export type SettingSection = 'content' | 'format' | 'text' | 'thresholds' | 'range' | 'appearance' | 'card' | 'labels' | 'advanced'

export interface ChartSetting {
  key: string
  label: string
  section: SettingSection
  control: SettingControl
  span?: SettingSpan
  options?: { value: string, label: string, plain?: boolean }[]
  visibleWhen?: { key: string, values: string[] }
  min?: number
  max?: number
  maxLength?: number
  required?: boolean
}

export interface ValueFormatter {
  full: (value: number) => string
  short: (value: number) => string
}

type Config = Record<string, unknown>

const CURRENCIES = ['AED', 'AUD', 'BRL', 'CAD', 'CHF', 'CNY', 'DKK', 'EUR', 'GBP', 'INR', 'JPY', 'KES', 'MXN', 'NGN', 'NOK', 'NZD', 'SEK', 'SGD', 'USD', 'ZAR']

export const setting = (key: string, label: string, section: SettingSection, control: SettingControl, extra: Partial<ChartSetting> = {}): ChartSetting => ({ key, label, section, control, ...extra })

export const FORMAT = [
  setting('valueFormat', 'Number format', 'format', 'select', {
    options: [
      { value: 'auto', label: 'Automatic' },
      { value: 'number', label: 'Number (1,234.50)' },
      { value: 'compact', label: 'Compact (1.2K)' },
      { value: 'currency', label: 'Currency' },
      { value: 'percent', label: 'Percentage (42 shows as 42%)' },
      { value: 'fraction', label: 'Percentage from fraction (0.42 shows as 42%)' }
    ]
  }),
  setting('currency', 'Currency', 'format', 'select', {
    options: CURRENCIES.map(code => ({ value: code, label: code, plain: true })),
    visibleWhen: { key: 'valueFormat', values: ['currency'] }
  }),
  setting('decimals', 'Decimal places', 'format', 'number', { min: 0, max: 6, span: 'third' }),
  setting('prefix', 'Text before', 'format', 'text', { span: 'third' }),
  setting('suffix', 'Text after', 'format', 'text', { span: 'third' })
]
export const THRESHOLDS = [
  setting('normalColor', 'Starting colour', 'thresholds', 'color', { span: 'full' }),
  setting('thresholds', 'Change colour at', 'thresholds', 'thresholds', { span: 'full' })
]
export const COLOR = setting('color', 'Colour', 'appearance', 'color')
export const AXIS = [
  setting('axisMin', 'Axis minimum', 'range', 'number'),
  setting('axisMax', 'Axis maximum', 'range', 'number')
]
export const REFERENCE = [
  setting('referenceValue', 'Target line value', 'range', 'number'),
  setting('referenceLabel', 'Target line label', 'range', 'text'),
  setting('referenceColor', 'Target line colour', 'range', 'color'),
  setting('referenceLineStyle', 'Target line style', 'range', 'select', {
    options: [{ value: 'dashed', label: 'Dashed' }, { value: 'solid', label: 'Solid' }, { value: 'dotted', label: 'Dotted' }]
  })
]
export const SHOW_VALUES = setting('showValues', 'Show values on the chart', 'appearance', 'switch')
const SLICE_LABELS = setting('labelMode', 'Slice labels', 'appearance', 'select', {
  options: [
    { value: 'auto', label: 'Automatic' },
    { value: 'none', label: 'None' },
    { value: 'name', label: 'Name' },
    { value: 'percent', label: 'Name and percentage' },
    { value: 'value', label: 'Name and value' }
  ]
})

export const SINGLE = [...FORMAT, COLOR, ...AXIS, ...REFERENCE, SHOW_VALUES]
export const PARTS = [...FORMAT, SLICE_LABELS]

export const CHART_SETTINGS: Record<string, ChartSetting[]> = {
  'table': FORMAT,
  'line-chart': SINGLE,
  'bar-chart': SINGLE,
  'stat-card': [...FORMAT, ...THRESHOLDS],
  'pie': PARTS
}

export const ADVANCED = setting('advancedOptions', 'ECharts options (JSON)', 'advanced', 'json', { span: 'full' })
// These widgets are drawn as HTML or a table, so ECharts options do not apply.
const NOT_ECHARTS = new Set(['table', 'stat-card'])

export const VALUE_SIZE = setting('valueFontSize', 'Number size', 'text', 'number', { min: 12, max: 120 })
export const LABEL_SIZE = setting('labelFontSize', 'Label size', 'text', 'number', { min: 10, max: 48 })
export const TEXT_ALIGN = setting('textAlign', 'Horizontal alignment', 'text', 'select', {
  options: [{ value: 'left', label: 'Left' }, { value: 'center', label: 'Centre' }, { value: 'right', label: 'Right' }]
})
export const VERTICAL_ALIGN = setting('verticalAlign', 'Vertical alignment', 'text', 'select', {
  options: [{ value: 'top', label: 'Top' }, { value: 'middle', label: 'Middle' }, { value: 'bottom', label: 'Bottom' }]
})
const TEXT_SETTINGS: Record<string, ChartSetting[]> = {
  'stat-card': [VALUE_SIZE, LABEL_SIZE, TEXT_ALIGN, VERTICAL_ALIGN],
  'table': [setting('tableFontSize', 'Text size', 'text', 'number', { min: 10, max: 32 }), TEXT_ALIGN]
}

for (const [id, settings] of Object.entries(TEXT_SETTINGS)) CHART_SETTINGS[id] = [...settings, ...CHART_SETTINGS[id]!]

/** Every widget can override its own card, on top of the dashboard style. */
export const CARD = [
  setting('cardHideTitle', 'Hide title', 'card', 'switch', { span: 'half' }),
  setting('cardHideShadow', 'Hide shadow', 'card', 'switch', { span: 'half' }),
  setting('cardBackground', 'Background colour', 'card', 'color'),
  setting('cardBorderColor', 'Border colour', 'card', 'color'),
  setting('cardBorderWidth', 'Border width', 'card', 'number', { min: 0, max: 8, span: 'third' }),
  setting('cardBorderStyle', 'Border style', 'card', 'select', {
    span: 'third',
    options: BORDER_STYLES.map(value => ({ value, label: value[0]!.toUpperCase() + value.slice(1) }))
  }),
  setting('cardRadius', 'Corner radius', 'card', 'number', { min: 0, max: 40, span: 'third' })
]

/** The title stays visible while the dashboard is being edited, so the widget can still be found. */
export const isCardTitleHidden = (config: Config) => config.cardHideTitle === true

/** Marks the card so the dashboard style can drop its shadow (see buildDashboardCss). */
export const isCardShadowHidden = (config: Config) => config.cardHideShadow === true

/**
 * Inline styles for a widget's card. They are !important so the widget's own
 * choice beats the dashboard style.
 */
export const getCardStyle = (config: Config): Record<string, string> => {
  const important = (value: string) => `${value} !important`
  const style: Record<string, string> = {}
  const background = colorSetting(config, 'cardBackground')
  const borderColor = colorSetting(config, 'cardBorderColor')
  const borderWidth = numberSetting(config, 'cardBorderWidth')
  const borderStyle = textSetting(config, 'cardBorderStyle')
  const radius = numberSetting(config, 'cardRadius')

  if (background) style.backgroundColor = important(background)

  if (borderColor || borderWidth !== null || isBorderStyle(borderStyle)) {
    const outline = outlineDeclarations(
      borderWidth ?? 1,
      isBorderStyle(borderStyle) ? borderStyle : 'solid',
      borderColor ?? 'var(--ui-border)'
    )

    style.outline = important(outline.outline)
    style.outlineOffset = important(outline.outlineOffset)

    // The widget's own border is the outline, so without a shadow nothing else is drawn.
    if (isCardShadowHidden(config)) style.boxShadow = important('none')
  }

  if (radius !== null) style.borderRadius = important(`${Math.min(Math.max(radius, 0), 40)}px`)

  return style
}

export const LABELS = setting('labelOverrides', 'Rename labels', 'labels', 'labels', { span: 'full' })

for (const [id, settings] of Object.entries(CHART_SETTINGS)) {
  CHART_SETTINGS[id] = [...settings, LABELS, ...(NOT_ECHARTS.has(id) ? [] : [ADVANCED])]
}

const HORIZONTAL_ALIGNMENT: Record<string, string> = { left: 'flex-start', center: 'center', right: 'flex-end' }
const VERTICAL_ALIGNMENT: Record<string, string> = { top: 'flex-start', middle: 'center', bottom: 'flex-end' }

/** Inline styles for text widgets. Sizes are !important so a widget's own size beats the dashboard's. */
export const getTextStyles = (config: Config) => {
  const size = (key: string, min: number, max: number) => {
    const value = numberSetting(config, key)

    return value === null ? {} : { fontSize: `${Math.min(Math.max(value, min), max)}px !important` }
  }
  const align = textSetting(config, 'textAlign')
  const vertical = textSetting(config, 'verticalAlign')
  const horizontal = HORIZONTAL_ALIGNMENT[align] ? { alignItems: HORIZONTAL_ALIGNMENT[align], textAlign: align } : {}

  return {
    horizontal,
    container: { ...horizontal, ...(VERTICAL_ALIGNMENT[vertical] ? { justifyContent: VERTICAL_ALIGNMENT[vertical] } : {}) },
    value: size('valueFontSize', 12, 120),
    label: size('labelFontSize', 10, 48),
    table: {
      ...(numberSetting(config, 'tableFontSize') === null ? {} : { '--widget-table-size': `${Math.min(Math.max(numberSetting(config, 'tableFontSize')!, 10), 32)}px` }),
      ...(HORIZONTAL_ALIGNMENT[align] ? { '--widget-table-align': align } : {})
    }
  }
}

export const numberSetting = (config: Config, key: string) => {
  const value = config[key]
  const number = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : Number.NaN

  return Number.isFinite(number) ? number : null
}

const textSetting = (config: Config, key: string) => typeof config[key] === 'string' ? config[key] as string : ''

// Colours reach inline styles, so only plain hex values are honoured.
export const colorSetting = (config: Config, key: string) => {
  const value = textSetting(config, key)

  return isHexColor(value) ? value : null
}

const VALUE_FORMATS = ['number', 'compact', 'currency', 'percent', 'fraction']

export const hasValueFormat = (config: Config) => {
  return VALUE_FORMATS.includes(textSetting(config, 'valueFormat')) || numberSetting(config, 'decimals') !== null || !!textSetting(config, 'prefix') || !!textSetting(config, 'suffix')
}

export const createValueFormatter = (config: Config, locale: string): ValueFormatter => {
  const format = textSetting(config, 'valueFormat')
  const rawDecimals = numberSetting(config, 'decimals')
  const decimals = rawDecimals === null ? null : Math.min(Math.max(Math.trunc(rawDecimals), 0), 6)
  const code = textSetting(config, 'currency')
  const currency = /^[A-Z]{3}$/.test(code) ? code : 'USD'
  const prefix = textSetting(config, 'prefix').slice(0, 12)
  const rawSuffix = textSetting(config, 'suffix').slice(0, 12)
  // Saved text is trimmed, so a unit such as kg needs its space added back.
  const suffix = /^\p{L}/u.test(rawSuffix) ? ` ${rawSuffix}` : rawSuffix
  const fixed = (fallback: number) => ({ minimumFractionDigits: decimals ?? fallback, maximumFractionDigits: decimals ?? fallback })
  const upTo = (fallback: number) => ({ maximumFractionDigits: decimals ?? fallback })
  const compact = { notation: 'compact' as const, ...upTo(1) }
  const money = { style: 'currency' as const, currency, currencyDisplay: 'narrowSymbol' as const }

  const fullOptions: Intl.NumberFormatOptions = format === 'number'
    ? (decimals === null ? upTo(2) : fixed(2))
    : format === 'compact' ? compact
      : format === 'currency' ? { ...money, ...fixed(2) }
        : format === 'percent' || format === 'fraction' ? upTo(1) : upTo(2)
  const shortOptions: Intl.NumberFormatOptions = format === 'currency'
    ? { ...money, notation: 'compact', ...upTo(1) }
    : format === 'percent' || format === 'fraction' ? upTo(1) : compact
  const render = (value: number, options: Intl.NumberFormatOptions) => {
    const scaled = format === 'fraction' ? value * 100 : value
    const percent = format === 'percent' || format === 'fraction' ? '%' : ''

    try {
      return `${prefix}${new Intl.NumberFormat(locale, options).format(scaled)}${percent}${suffix}`
    } catch {
      return `${prefix}${scaled}${percent}${suffix}`
    }
  }

  return { full: value => render(value, fullOptions), short: value => render(value, shortOptions) }
}

export interface ValueBand {
  from: number
  color: string
}

export interface ThresholdStep {
  from: number | null
  color: string
}

export const MAX_THRESHOLD_STEPS = 5

// Offered in turn as steps are added; each can then be changed.
export const THRESHOLD_STEP_COLORS = ['#fab219', '#d03b3b', '#ec835a', '#6250d6', '#2a78d6']
const STARTING_COLOR = '#0ca30c'

/** Steps are saved as one JSON string because widget settings hold plain values only. */
export const parseThresholdSteps = (config: Config): ThresholdStep[] => {
  try {
    const parsed: unknown = JSON.parse(textSetting(config, 'thresholds') || '[]')

    if (!Array.isArray(parsed)) return []

    return parsed.slice(0, MAX_THRESHOLD_STEPS).map((step: { from?: unknown, color?: unknown }, index) => ({
      from: typeof step?.from === 'number' && Number.isFinite(step.from) ? step.from : null,
      color: isHexColor(step?.color) ? step.color : THRESHOLD_STEP_COLORS[index]!
    }))
  } catch {
    return []
  }
}

/** Turns the colour steps into ordered bands, or null when none are complete. */
export const resolveBands = (config: Config): ValueBand[] | null => {
  const steps = parseThresholdSteps(config).flatMap(step => step.from === null ? [] : [{ from: step.from, color: step.color }])

  if (!steps.length) return null

  return [
    { from: Number.NEGATIVE_INFINITY, color: colorSetting(config, 'normalColor') ?? STARTING_COLOR },
    ...steps.sort((a, b) => a.from - b.from)
  ]
}

export const bandFor = (bands: ValueBand[] | null, value: number) => {
  return bands?.filter(band => value >= band.from).at(-1) ?? null
}

/** Converts bands to the [fraction, colour] stops a gauge axis expects. */
export const bandStops = (bands: ValueBand[], min: number, max: number): [number, string][] => {
  return bands.flatMap((band, index) => {
    const next = bands[index + 1]
    const end = next ? Math.min(Math.max((next.from - min) / (max - min), 0), 1) : 1

    return next && end <= 0 ? [] : [[end, band.color] as [number, string]]
  })
}

export const applyColorSettings = (colors: ChartColors, config: Config): ChartColors => {
  const primary = colorSetting(config, 'color')

  return {
    ...colors,
    primary: primary ?? colors.primary,
    categorical: primary ? [primary, ...colors.categorical.slice(1)] : colors.categorical,
    positive: colorSetting(config, 'positiveColor') ?? colors.positive,
    negative: colorSetting(config, 'negativeColor') ?? colors.negative,
    neutral: colorSetting(config, 'totalColor') ?? colors.neutral,
    sequential: [colorSetting(config, 'lowColor') ?? colors.sequential[0], colorSetting(config, 'highColor') ?? colors.sequential[1]]
  }
}

type LooseOption = Record<string, any>

/** Applies axis limits, a target line and value labels to any x/y chart. */
export const applyCartesianSettings = <T extends object>(option: T, config: Config, format: ValueFormatter, colors: Pick<ChartColors, 'ink' | 'label'>): T => {
  const result = { ...option } as LooseOption

  if (!result.xAxis || !result.yAxis) return option

  const min = numberSetting(config, 'axisMin')
  const max = numberSetting(config, 'axisMax')
  const reference = numberSetting(config, 'referenceValue')
  const showValues = config.showValues === true
  const horizontal = result.yAxis.type === 'category'
  const axis = horizontal ? 'xAxis' : 'yAxis'

  if (min !== null || max !== null) {
    result[axis] = { ...result[axis], ...(min === null ? {} : { min }), ...(max === null ? {} : { max }) }
  }

  if (reference === null && !showValues) return result as T

  const isVisible = (series: LooseOption) => ['bar', 'line'].includes(series.type) && !series.silent
  let referenceDrawn = false

  result.series = (result.series as LooseOption[]).map((series) => {
    if (!isVisible(series)) return series

    const next = { ...series }

    if (showValues) {
      next.label = {
        show: true,
        position: series.stack ? 'inside' : horizontal ? 'right' : 'top',
        color: series.stack ? '#ffffff' : colors.label,
        fontSize: 10,
        formatter: (item: { value: unknown }) => typeof item.value === 'number' ? format.short(item.value) : ''
      }
    }

    if (reference !== null && !referenceDrawn) {
      referenceDrawn = true
      next.markLine = {
        silent: true,
        symbol: 'none',
        lineStyle: {
          color: colorSetting(config, 'referenceColor') ?? colors.ink,
          type: ['solid', 'dotted'].includes(textSetting(config, 'referenceLineStyle')) ? textSetting(config, 'referenceLineStyle') : 'dashed',
          width: 1
        },
        label: { color: colors.label, fontSize: 10, position: 'insideEndTop', formatter: textSetting(config, 'referenceLabel') || format.short(reference) },
        data: [horizontal ? { xAxis: reference } : { yAxis: reference }]
      }
    }

    return next
  })

  return result as T
}

const MAX_ADVANCED_OPTIONS_LENGTH = 20_000
// Tooltips render as HTML and dashboards can be public, so saved options must
// not be able to add markup, styles or requests to other sites.
const BLOCKED_OPTION_KEYS = new Set(['__proto__', 'prototype', 'constructor', 'extraCssText', 'appendTo', 'className', 'graphic', 'image', 'renderMode', 'richInheritPlainLabel'])
const UNSAFE_OPTION_TEXT = /[<>]|image:\/\/|url\(|javascript:|data:/i

const AXIS_TYPES = ['category', 'value', 'time', 'log']
const ALLOWED_COMPONENT_TYPES: Record<string, string[]> = {
  xAxis: AXIS_TYPES,
  yAxis: AXIS_TYPES,
  radiusAxis: AXIS_TYPES,
  angleAxis: AXIS_TYPES,
  singleAxis: AXIS_TYPES,
  visualMap: ['continuous', 'piecewise'],
  dataZoom: ['inside', 'slider'],
  legend: ['plain', 'scroll']
}

const sanitizeOptions = (value: unknown): unknown => {
  if (typeof value === 'string') return UNSAFE_OPTION_TEXT.test(value) ? undefined : value
  if (Array.isArray(value)) return value.map(sanitizeOptions).filter(item => item !== undefined)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).flatMap(([key, entry]) => {
      const clean = BLOCKED_OPTION_KEYS.has(key) ? undefined : sanitizeOptions(entry)

      return clean === undefined ? [] : [[key, clean]]
    }))
  }

  return value
}

/** Reads a widget's advanced options, or reports that they cannot be used. */
export const parseAdvancedOptions = (config: Config): { options: LooseOption | null, invalid: boolean } => {
  const text = textSetting(config, 'advancedOptions')

  if (!text.trim()) return { options: null, invalid: false }

  try {
    const parsed: unknown = text.length <= MAX_ADVANCED_OPTIONS_LENGTH ? JSON.parse(text) : null

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { options: null, invalid: true }

    const options = sanitizeOptions(parsed) as LooseOption

    // ECharts throws on an unknown type, which would leave the widget blank.
    for (const [component, allowed] of Object.entries(ALLOWED_COMPONENT_TYPES)) {
      const removeBadType = (item: LooseOption) => {
        if (item && typeof item === 'object' && 'type' in item && !allowed.includes(item.type)) delete item.type
      }

      if (Array.isArray(options[component])) options[component].forEach(removeBadType)
      else removeBadType(options[component])
    }

    // Changing a series' kind would break the data shape this chart built.
    if (Array.isArray(options.series)) {
      options.series = options.series.map((series: LooseOption) => {
        const { type: _type, coordinateSystem: _coordinateSystem, ...rest } = series ?? {}

        return rest
      })
    }

    return { options, invalid: false }
  } catch {
    return { options: null, invalid: true }
  }
}

const isPlainObject = (value: unknown): value is LooseOption => !!value && typeof value === 'object' && !Array.isArray(value)

const mergeOptions = (base: unknown, override: unknown): unknown => {
  if (isPlainObject(base) && isPlainObject(override)) {
    const merged: LooseOption = { ...base }

    for (const [key, value] of Object.entries(override)) merged[key] = mergeOptions(base[key], value)

    return merged
  }

  // Series merge by position, so data the chart built survives; other arrays replace.
  if (Array.isArray(base) && Array.isArray(override) && base.every(isPlainObject) && override.every(isPlainObject)) {
    return [...base.map((item, index) => index < override.length ? mergeOptions(item, override[index]) : item), ...override.slice(base.length)]
  }

  return override
}

export const applyAdvancedOptions = <T extends object>(option: T, config: Config): T => {
  const { options } = parseAdvancedOptions(config)

  return options ? mergeOptions(option, options) as T : option
}

export interface LabelOverride {
  from: string
  to: string
}

export const MAX_LABEL_OVERRIDES = 200

/** Overrides are saved as one JSON string because widget settings hold plain values only. */
export const parseLabelOverrides = (config: Config): LabelOverride[] => {
  try {
    const parsed: unknown = JSON.parse(textSetting(config, 'labelOverrides') || '[]')

    if (!Array.isArray(parsed)) return []

    return parsed.slice(0, MAX_LABEL_OVERRIDES).map((item: { from?: unknown, to?: unknown }) => ({
      from: typeof item?.from === 'string' ? item.from.slice(0, 200) : '',
      to: typeof item?.to === 'string' ? item.to.slice(0, 200) : ''
    }))
  } catch {
    return []
  }
}

const labelMap = (config: Config) => new Map(parseLabelOverrides(config).filter(item => item.from && item.to).map(item => [item.from, item.to]))

/** Replaces exact text matches in result rows, leaving column names and numbers alone. */
export const applyLabelOverridesToRows = <T extends Record<string, unknown>>(rows: T[], config: Config): T[] => {
  const labels = labelMap(config)

  if (!labels.size) return rows

  return rows.map(row => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, typeof value === 'string' ? labels.get(value) ?? value : value])) as T)
}

export const overrideLabel = (config: Config, label: string) => labelMap(config).get(label) ?? label

/** Renames the series and legend entries that come from column names. */
export const applyLabelOverridesToOption = <T extends object>(option: T, config: Config): T => {
  const labels = labelMap(config)

  if (!labels.size) return option

  const rename = (name: unknown) => typeof name === 'string' ? labels.get(name) ?? name : name
  const result = { ...option } as LooseOption

  if (Array.isArray(result.series)) {
    result.series = result.series.map((series: LooseOption) => ({
      ...series,
      ...(series.name === undefined ? {} : { name: rename(series.name) }),
      ...(series.type === 'radar' ? { data: series.data.map((item: LooseOption) => ({ ...item, name: rename(item.name) })) } : {}),
      ...(series.type === 'themeRiver' ? { data: series.data.map((item: unknown[]) => [item[0], item[1], rename(item[2])]) } : {})
    }))
  }

  if (Array.isArray(result.legend?.data)) {
    result.legend = { ...result.legend, data: result.legend.data.map(rename) }
  }

  return result as T
}

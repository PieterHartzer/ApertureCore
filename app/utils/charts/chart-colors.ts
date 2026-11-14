// Validated with the data-viz palette checks. Slot order is what keeps
// neighbouring series distinguishable, so colours are never re-ordered or cycled.
const LIGHT_CATEGORICAL = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948']
const DARK_CATEGORICAL = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767']

export const MAX_CATEGORICAL_SERIES = LIGHT_CATEGORICAL.length

export interface ChartColors {
  categorical: string[]
  primary: string
  // Low to high magnitude, with low receding into the surface.
  sequential: [string, string]
  // Light to strong steps for ordered marks such as funnel stages.
  ordinal: string[]
  positive: string
  negative: string
  neutral: string
  surface: string
  grid: string
  label: string
  ink: string
  tooltipBackground: string
  tooltipBorder: string
  /** Text on the tooltip; defaults to ink when the tooltip is light. */
  tooltipText?: string
  /** Width of chart lines; charts keep their own width when unset. */
  lineWidth?: number
  /** Opacity of the fill under a line (not stacked areas); charts keep their own when unset. */
  areaOpacity?: number
  /** Fill under a chart's only line; the line's own colour when unset. */
  areaColor?: string
}

type SeriesLike = Record<string, unknown> & { type?: unknown, stack?: unknown, lineStyle?: Record<string, unknown>, areaStyle?: Record<string, unknown> }

/**
 * Applies the palette's line width and area fill to line series. Lines drawn
 * on purpose (hidden band edges, thin reference lines) and stacked areas keep
 * their own look.
 */
export const applySeriesStyle = <T>(option: T, colors: ChartColors): T => {
  const source = (option as { series?: unknown }).series

  if (!source || (colors.lineWidth === undefined && colors.areaOpacity === undefined)) return option

  const list = (Array.isArray(source) ? source : [source]) as SeriesLike[]
  const lines = list.filter(series => series?.type === 'line')
  const series = list.map((item) => {
    if (item?.type !== 'line') return item

    const width = item.lineStyle?.width
    const visible = item.lineStyle?.opacity !== 0
    const next: SeriesLike = { ...item }

    if (colors.lineWidth !== undefined && visible && (width === undefined || width === 2)) {
      next.lineStyle = { ...item.lineStyle, width: colors.lineWidth }
    }

    if (colors.areaOpacity !== undefined && item.areaStyle && !item.stack) {
      next.areaStyle = {
        ...item.areaStyle,
        opacity: colors.areaOpacity,
        ...(lines.length === 1 && colors.areaColor ? { color: colors.areaColor } : {})
      }
    }

    return next
  })

  return { ...option, series: Array.isArray(source) ? series : series[0] }
}

export interface ChartColorTheme {
  light: Partial<ChartColors>
  dark: Partial<ChartColors>
}

let chartColorTheme: ChartColorTheme | null = null

/** Lets a layer replace the default chart colours, for example with its brand palette. */
export const registerChartColors = (theme: ChartColorTheme | null) => {
  chartColorTheme = theme
}

export const getChartColors = (dark: boolean): ChartColors => ({
  ...defaultChartColors(dark),
  ...(chartColorTheme?.[dark ? 'dark' : 'light'] ?? {})
})

const defaultChartColors = (dark: boolean): ChartColors => dark
  ? {
      categorical: DARK_CATEGORICAL,
      primary: DARK_CATEGORICAL[0]!,
      sequential: ['#184f95', '#b7d3f6'],
      ordinal: ['#b7d3f6', '#86b6ef', '#5598e7', '#3987e5', '#2a78d6', '#256abf', '#1c5cab', '#184f95'],
      positive: '#3987e5',
      negative: '#e66767',
      neutral: '#737373',
      surface: '#141414',
      grid: '#262626',
      label: '#a1a1a1',
      ink: '#fafafa',
      tooltipBackground: '#1a1a1a',
      tooltipBorder: '#2a2a2a'
    }
  : {
      categorical: LIGHT_CATEGORICAL,
      primary: LIGHT_CATEGORICAL[0]!,
      sequential: ['#cde2fb', '#0d366b'],
      ordinal: ['#0d366b', '#104281', '#184f95', '#1c5cab', '#256abf', '#2a78d6', '#5598e7', '#86b6ef'],
      positive: '#2a78d6',
      negative: '#e34948',
      neutral: '#a3a3a3',
      surface: '#ffffff',
      grid: '#e5e5e5',
      label: '#737373',
      ink: '#171717',
      tooltipBackground: '#ffffff',
      tooltipBorder: '#e5e5e5'
    }

/** Mixes two #rrggbb colours; 0 gives the first, 1 the second. Any opacity is dropped. */
export const mixHexColors = (from: string, to: string, amount: number) => {
  const channel = (hex: string, start: number) => Number.parseInt(hex.slice(start, start + 2), 16)

  return '#' + [1, 3, 5].map((start) => {
    const value = Math.round(channel(from, start) + (channel(to, start) - channel(from, start)) * amount)

    return value.toString(16).padStart(2, '0')
  }).join('')
}

export interface DashboardChartColorStyle {
  primary?: string
  series?: (string | undefined)[]
  heatLow?: string
  heatHigh?: string
  surface?: string
  text?: string
  grid?: string
}

/**
 * Lays a dashboard's own colours over the default palette. Series colours replace
 * the defaults slot by slot. Heatmaps use the lowest and highest colours; with
 * only a main colour, they fade from the background to it. Funnel stages step
 * from the strongest colour towards the lowest one.
 */
export const applyDashboardChartColors = (colors: ChartColors, style: DashboardChartColorStyle): ChartColors => {
  const surface = style.surface ?? colors.surface
  const categorical = colors.categorical.map((color, index) => (index === 0 ? style.primary : style.series?.[index - 1]) ?? color)
  const strong = style.heatHigh ?? style.primary
  const weak = style.heatLow ?? (strong ? mixHexColors(strong, surface, 0.88) : undefined)
  const steps = colors.ordinal.length

  return {
    ...colors,
    primary: style.primary ?? colors.primary,
    categorical,
    surface,
    sequential: strong && weak ? [weak, strong] : colors.sequential,
    ordinal: strong && weak
      ? Array.from({ length: steps }, (_, index) => mixHexColors(strong, weak, (index / Math.max(steps - 1, 1)) * 0.8))
      : colors.ordinal,
    // A dashboard's own main colour also fills the area under its lines.
    areaColor: style.primary ? undefined : colors.areaColor,
    label: style.text ?? colors.label,
    grid: style.grid ?? colors.grid
  }
}

export const readableTextOn = (hex: string) => {
  const channel = (start: number) => {
    const value = Number.parseInt(hex.slice(start, start + 2), 16) / 255

    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  }
  const luminance = 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5)

  return luminance > 0.25 ? '#0b0b0b' : '#ffffff'
}

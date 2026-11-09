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
}

export const getChartColors = (dark: boolean): ChartColors => dark
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

export const applyDashboardChartColors = (colors: ChartColors, style: { primary?: string, text?: string, grid?: string }): ChartColors => ({
  ...colors,
  primary: style.primary ?? colors.primary,
  categorical: style.primary ? [style.primary, ...colors.categorical.slice(1)] : colors.categorical,
  label: style.text ?? colors.label,
  grid: style.grid ?? colors.grid
})

export const readableTextOn = (hex: string) => {
  const channel = (start: number) => {
    const value = Number.parseInt(hex.slice(start, start + 2), 16) / 255

    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  }
  const luminance = 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5)

  return luminance > 0.25 ? '#0b0b0b' : '#ffffff'
}

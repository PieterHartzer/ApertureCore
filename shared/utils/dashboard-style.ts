import { isHexColor } from './color'
import { DASHBOARD_STYLE_FIELDS, type DashboardStyle } from './dashboard-style-fields'

export const DASHBOARD_CANVAS = '[data-dashboard-canvas]'

const FONT_STACKS: Record<string, string> = {
  sans: 'Inter, ui-sans-serif, system-ui, sans-serif',
  serif: 'ui-serif, Georgia, Cambria, serif',
  mono: 'ui-monospace, "JetBrains Mono", Menlo, monospace'
}
const SHADOWS: Record<string, string> = {
  small: '0 1px 3px rgb(0 0 0 / 0.25)',
  medium: '0 6px 16px rgb(0 0 0 / 0.3)',
  large: '0 16px 40px rgb(0 0 0 / 0.4)'
}


export interface DashboardStyleExtension {
  /** Copies any extra properties onto style and reports whether they are invalid. */
  normalize: (source: Record<string, unknown>, style: DashboardStyle) => boolean
  css: (style: DashboardStyle) => string
}

const styleExtensions: DashboardStyleExtension[] = []

export const registerDashboardStyleExtension = (extension: DashboardStyleExtension) => {
  if (!styleExtensions.includes(extension)) styleExtensions.push(extension)
}

/** Keeps only known properties with valid values. */
export const normalizeDashboardStyle = (value: unknown): { style: DashboardStyle, invalid: boolean } => {
  const source = (value && typeof value === 'object' && !Array.isArray(value) ? value : {}) as Record<string, unknown>
  const style: DashboardStyle = {}

  for (const field of DASHBOARD_STYLE_FIELDS) {
    const entry = source[field.key]

    if (field.control === 'color' && isHexColor(entry)) style[field.key] = entry
    else if (field.control === 'number' && typeof entry === 'number' && Number.isFinite(entry)) style[field.key] = Math.min(Math.max(entry, field.min ?? 0), field.max ?? entry)
    else if (field.control === 'select' && typeof entry === 'string' && field.options?.some(option => option.value === entry)) style[field.key] = entry
    else if (field.control === 'switch' && entry === true) style[field.key] = true
  }

  const invalid = styleExtensions.map(extension => extension.normalize(source, style)).some(Boolean)

  return { style, invalid }
}

const cssRule = (selector: string, declarations: (string | null)[]) => {
  const body = declarations.filter(Boolean).join(' ')

  return body ? `${selector} { ${body} }` : ''
}
const declaration = (property: string, value: unknown, unit = '') => value === undefined ? null : `${property}: ${value}${unit} !important;`

/** Builds the page's stylesheet from validated properties. */
export const buildDashboardCss = (input: unknown) => {
  const { style } = normalizeDashboardStyle(input)
  const card = `${DASHBOARD_CANVAS} [data-widget-card]`
  const borderSet = style.borderWidth !== undefined || style.borderColor !== undefined
  const ring = borderSet ? `inset 0 0 0 ${style.borderWidth ?? 1}px ${style.borderColor ?? 'var(--ui-border)'}` : null
  const shadow = typeof style.shadow === 'string' ? SHADOWS[style.shadow] ?? null : null
  const boxShadow = ring || shadow ? [ring, shadow].filter(Boolean).join(', ') : undefined
  const padding = style.cardPadding
  const font = typeof style.fontFamily === 'string' ? FONT_STACKS[style.fontFamily] : undefined

  return [
    cssRule(DASHBOARD_CANVAS, ['isolation: isolate;', 'overflow: clip;', 'overflow-clip-margin: 12px;', declaration('color', style.textColor), declaration('font-family', font)]),
    cssRule('body::before', [style.pageBackground === undefined ? null : `background: ${style.pageBackground} !important;`]),
    cssRule(`${DASHBOARD_CANVAS} .grid-stack`, style.widgetGap === undefined ? [] : ['top', 'right', 'bottom', 'left'].map(side => `--gs-item-margin-${side}: ${Number(style.widgetGap) / 2}px !important;`)),
    cssRule(card, [declaration('background-color', style.cardBackground), declaration('box-shadow', boxShadow), declaration('border-radius', style.borderRadius, 'px')]),
    padding === undefined ? '' : cssRule(`${card} > :first-child`, [`padding: ${padding}px ${padding}px 0 !important;`]),
    padding === undefined ? '' : cssRule(`${card} > :last-child`, [`padding: 4px ${padding}px ${padding}px !important;`]),
    style.hideTitles ? cssRule(`${DASHBOARD_CANVAS}:not([data-editing]) [data-widget-title]`, ['visibility: hidden;']) : '',
    cssRule(`${DASHBOARD_CANVAS} [data-widget-title]`, [declaration('color', style.titleColor), declaration('font-size', style.titleSize, 'px'), declaration('font-weight', style.titleWeight), declaration('text-align', style.titleAlign), style.titleAlign ? 'flex: 1 1 0%;' : null]),
    cssRule(`${DASHBOARD_CANVAS} [data-widget-value]`, [declaration('color', style.valueColor), declaration('font-size', style.valueSize, 'px')]),
    cssRule(`${DASHBOARD_CANVAS} [data-widget-label]`, [declaration('color', style.labelColor)]),
    ...styleExtensions.map(extension => extension.css(style))
  ].filter(Boolean).join('\n')
}

export interface DashboardChartStyle {
  primary?: string
  text?: string
  grid?: string
  fontFamily?: string
}

export const getDashboardChartStyle = (input: unknown): DashboardChartStyle => {
  const { style } = normalizeDashboardStyle(input)
  const text = (key: string) => typeof style[key] === 'string' ? style[key] as string : undefined

  return {
    primary: text('chartPrimary'),
    text: text('chartText'),
    grid: text('chartGrid'),
    fontFamily: FONT_STACKS[text('fontFamily') ?? '']
  }
}

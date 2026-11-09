import { DASHBOARD_STYLE_FIELDS, type DashboardStyle } from './dashboard-style-fields'

export const DASHBOARD_CANVAS = '[data-dashboard-canvas]'

const HEX_COLOR = /^#[0-9a-f]{6}$/i
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


/** Keeps only known properties with valid values. */
export const normalizeDashboardStyle = (value: unknown): { style: DashboardStyle, invalid: boolean } => {
  const source = (value && typeof value === 'object' && !Array.isArray(value) ? value : {}) as Record<string, unknown>
  const style: DashboardStyle = {}

  for (const field of DASHBOARD_STYLE_FIELDS) {
    const entry = source[field.key]

    if (field.control === 'color' && typeof entry === 'string' && HEX_COLOR.test(entry)) style[field.key] = entry
    else if (field.control === 'number' && typeof entry === 'number' && Number.isFinite(entry)) style[field.key] = Math.min(Math.max(entry, field.min ?? 0), field.max ?? entry)
    else if (field.control === 'select' && typeof entry === 'string' && field.options?.some(option => option.value === entry)) style[field.key] = entry
    else if (field.control === 'switch' && entry === true) style[field.key] = true
  }

  return { style, invalid: false }
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
    cssRule(`${DASHBOARD_CANVAS} [data-widget-label]`, [declaration('color', style.labelColor)])
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

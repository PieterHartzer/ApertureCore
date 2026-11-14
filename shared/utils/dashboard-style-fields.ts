export type DashboardStyleControl = 'color' | 'number' | 'select' | 'switch'
export type DashboardStyleGroup = 'page' | 'widgets' | 'titles' | 'values' | 'charts' | 'chartColors'

export interface DashboardStyleField {
  key: string
  label: string
  group: DashboardStyleGroup
  control: DashboardStyleControl
  min?: number
  max?: number
  options?: { value: string, label: string }[]
}

const color = (key: string, label: string, group: DashboardStyleGroup): DashboardStyleField => ({ key, label, group, control: 'color' })
const size = (key: string, label: string, group: DashboardStyleGroup, min: number, max: number): DashboardStyleField => ({ key, label, group, control: 'number', min, max })
const choice = (key: string, label: string, group: DashboardStyleGroup, options: [string, string][]): DashboardStyleField => ({
  key,
  label,
  group,
  control: 'select',
  options: options.map(([value, text]) => ({ value, label: text }))
})

/** Style keys for series 2 to 6. */
export const CHART_SERIES_KEYS = ['chartColor2', 'chartColor3', 'chartColor4', 'chartColor5', 'chartColor6'] as const

export const DASHBOARD_STYLE_GROUPS: { id: DashboardStyleGroup, label: string }[] = [
  { id: 'page', label: 'Page' },
  { id: 'widgets', label: 'Widgets' },
  { id: 'titles', label: 'Widget titles' },
  { id: 'values', label: 'Numbers and labels' },
  { id: 'charts', label: 'Charts' },
  { id: 'chartColors', label: 'Chart colours' }
]

export const DASHBOARD_STYLE_FIELDS: DashboardStyleField[] = [
  color('pageBackground', 'Background colour', 'page'),
  color('textColor', 'Text colour', 'page'),
  choice('fontFamily', 'Font', 'page', [['sans', 'Sans serif'], ['serif', 'Serif'], ['mono', 'Monospace']]),
  size('widgetGap', 'Space between widgets', 'page', 0, 32),
  color('cardBackground', 'Background colour', 'widgets'),
  color('borderColor', 'Border colour', 'widgets'),
  size('borderWidth', 'Border width', 'widgets', 0, 8),
  choice('borderStyle', 'Border style', 'widgets', [['solid', 'Solid'], ['dashed', 'Dashed'], ['dotted', 'Dotted'], ['double', 'Double']]),
  size('borderRadius', 'Corner radius', 'widgets', 0, 40),
  size('cardPadding', 'Inner padding', 'widgets', 0, 40),
  choice('shadow', 'Shadow', 'widgets', [['none', 'None'], ['small', 'Small'], ['medium', 'Medium'], ['large', 'Large']]),
  { key: 'hideTitles', label: 'Hide titles', group: 'titles', control: 'switch' },
  color('titleColor', 'Colour', 'titles'),
  size('titleSize', 'Size', 'titles', 10, 32),
  choice('titleWeight', 'Weight', 'titles', [['400', 'Regular'], ['500', 'Medium'], ['600', 'Semibold'], ['700', 'Bold']]),
  choice('titleAlign', 'Alignment', 'titles', [['left', 'Left'], ['center', 'Centre'], ['right', 'Right']]),
  color('valueColor', 'Number colour', 'values'),
  size('valueSize', 'Number size', 'values', 14, 96),
  color('labelColor', 'Label colour', 'values'),
  color('chartPrimary', 'Main series colour', 'charts'),
  color('chartText', 'Axis text colour', 'charts'),
  color('chartGrid', 'Grid line colour', 'charts'),
  // Series 1 is the main series colour above; these colour the next series in order.
  ...CHART_SERIES_KEYS.map((key, index) => color(key, `Series ${index + 2}`, 'chartColors')),
  // Heatmaps and calendars run from low to high; funnels step from high towards low.
  color('chartHeatLow', 'Lowest values', 'chartColors'),
  color('chartHeatHigh', 'Highest values', 'chartColors')
]

export type DashboardStyle = Record<string, string | number | boolean>

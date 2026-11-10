export type DashboardStyleControl = 'color' | 'number' | 'select' | 'switch'
export type DashboardStyleGroup = 'page' | 'widgets' | 'titles' | 'values' | 'charts'

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

export const DASHBOARD_STYLE_GROUPS: { id: DashboardStyleGroup, label: string }[] = [
  { id: 'page', label: 'Page' },
  { id: 'widgets', label: 'Widgets' },
  { id: 'titles', label: 'Widget titles' },
  { id: 'values', label: 'Numbers and labels' },
  { id: 'charts', label: 'Charts' }
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
  color('chartGrid', 'Grid line colour', 'charts')
]

export type DashboardStyle = Record<string, string | number | boolean>

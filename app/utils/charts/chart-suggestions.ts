import {
  getUIPluginInputSelectionMode,
  getUIPluginInputSource,
  type PluginInputDefinition,
  type UIPluginFieldOption
} from '../../types/uiPlugin'

/** What a query returned, reduced to what matters for choosing a chart. */
export interface ResultShape {
  rowCount: number
  numbers: string[]
  dates: string[]
  texts: string[]
  /** Longest text value in the first text column, for choosing horizontal bars. */
  longestText: number
}

/** Scores how well one widget fits a result. Zero or less means it does not fit. */
export interface ChartSuggestionRule {
  pluginId: string
  score: (shape: ResultShape) => number
}

/** Labels longer than this read better on horizontal bars. */
export const LONG_LABEL_LENGTH = 14

export const describeResultShape = (
  fields: UIPluginFieldOption[],
  rows: Array<Record<string, unknown>>
): ResultShape => {
  const ofType = (type: UIPluginFieldOption['fieldType']) => fields.filter(field => field.fieldType === type).map(field => field.value)
  const texts = ofType('string')
  const firstText = texts[0]

  return {
    rowCount: rows.length,
    numbers: ofType('number'),
    dates: ofType('date'),
    texts,
    longestText: firstText
      ? rows.reduce((longest, row) => Math.max(longest, String(row[firstText] ?? '').length), 0)
      : 0
  }
}

const isCategoryList = (shape: ResultShape) => shape.texts.length >= 1 && shape.dates.length === 0
const isTimeSeries = (shape: ResultShape) => shape.dates.length >= 1 && shape.rowCount >= 2

/**
 * Rules for the widgets Core ships. Higher scores win; a layer adds rules for
 * its own widgets with registerChartSuggestions.
 */
const CHART_SUGGESTION_RULES: ChartSuggestionRule[] = [
  {
    pluginId: 'stat-card',
    score: shape => shape.rowCount === 1 && shape.numbers.length >= 1 ? 80 : 0
  },
  {
    pluginId: 'line-chart',
    score: shape => isTimeSeries(shape) && shape.numbers.length >= 1 ? 85 : 0
  },
  {
    pluginId: 'bar-chart',
    score: (shape) => {
      if (shape.numbers.length < 1 || shape.rowCount < 2) return 0
      if (isCategoryList(shape)) return shape.rowCount <= 15 ? 75 : 55
      if (isTimeSeries(shape)) return 60

      return 0
    }
  },
  {
    pluginId: 'pie',
    score: shape => isCategoryList(shape) && shape.numbers.length === 1 && shape.rowCount >= 2 && shape.rowCount <= 6 ? 78 : 0
  },
  {
    pluginId: 'table',
    // Always fits, so it is the fallback when nothing else does.
    score: shape => shape.rowCount > 0 ? 10 : 0
  }
]

export const registerChartSuggestions = (rules: ChartSuggestionRule[]) => {
  for (const rule of rules) {
    const index = CHART_SUGGESTION_RULES.findIndex(item => item.pluginId === rule.pluginId)

    if (index === -1) CHART_SUGGESTION_RULES.push(rule)
    else CHART_SUGGESTION_RULES[index] = rule
  }
}

/** Widgets that fit the result, best first, limited to those that are available. */
export const suggestCharts = (shape: ResultShape, availableIds: Iterable<string>, limit = 3): string[] => {
  if (shape.rowCount === 0) return []

  const available = new Set(availableIds)

  return CHART_SUGGESTION_RULES
    .filter(rule => available.has(rule.pluginId))
    .map((rule, order) => ({ id: rule.pluginId, score: rule.score(shape), order }))
    .filter(entry => entry.score > 0)
    .sort((left, right) => right.score - left.score || left.order - right.order)
    .slice(0, limit)
    .map(entry => entry.id)
}

const accepts = (input: PluginInputDefinition, type: UIPluginFieldOption['fieldType']) => {
  return !input.compatibleFieldTypes?.length || input.compatibleFieldTypes.includes(type)
}

// Labels and axes read best as dates, then text; values must be numbers.
const PREFERENCE: Array<UIPluginFieldOption['fieldType']> = ['date', 'string', 'number', 'boolean', 'unknown']

/**
 * Fills the widget's empty column choices from the result: dates or text for
 * labels and axes, a different number for each value. Choices already made
 * are kept.
 */
export const autoMapFields = <T extends Record<string, unknown>>(
  inputs: PluginInputDefinition[],
  fields: UIPluginFieldOption[],
  config: T
): T => {
  const next: Record<string, unknown> = { ...config }
  const used = new Set<string>()
  const fieldInputs = inputs.filter(input => getUIPluginInputSource(input) === 'field')
  const isEmpty = (value: unknown) => value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0)

  for (const input of fieldInputs) {
    const value = next[input.key]

    if (typeof value === 'string' && value) used.add(value)
    if (Array.isArray(value)) value.forEach(item => typeof item === 'string' && used.add(item))
  }

  const empty = fieldInputs.filter(input => input.required && isEmpty(next[input.key]))
  const isNumberOnly = (input: PluginInputDefinition) => input.compatibleFieldTypes?.length === 1 && input.compatibleFieldTypes[0] === 'number'
  // Numbers the value inputs still need, so a label never takes the only number a value needs.
  let reserved = empty.filter(isNumberOnly).length
  const freeNumbers = () => fields.filter(field => field.fieldType === 'number' && !used.has(field.value)).length

  for (const input of empty) {
    if (isNumberOnly(input)) reserved -= 1

    const candidates = PREFERENCE
      .filter(type => accepts(input, type))
      .filter(type => type !== 'number' || isNumberOnly(input) || freeNumbers() > reserved)
      .flatMap(type => fields.filter(field => field.fieldType === type && !used.has(field.value)))

    if (getUIPluginInputSelectionMode(input) === 'multiple') {
      const numbers = candidates.filter(field => field.fieldType === 'number')
      const chosen = (numbers.length ? numbers : candidates).map(field => field.value)

      chosen.forEach(value => used.add(value))
      next[input.key] = chosen
      continue
    }

    const choice = candidates[0]

    if (choice) {
      used.add(choice.value)
      next[input.key] = choice.value
    }
  }

  return next as T
}

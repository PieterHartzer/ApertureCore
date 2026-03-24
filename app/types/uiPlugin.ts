import type { Component } from 'vue'

import type {
  SavedSqlQueryResultRow,
  SavedSqlQueryResultValue
} from '~/types/saved-sql-queries'

export const UI_PLUGIN_INPUT_TYPES = ['string', 'number', 'date'] as const
export type UIPluginInputType = (typeof UI_PLUGIN_INPUT_TYPES)[number]

export const UI_PLUGIN_FIELD_TYPES = [
  'string',
  'number',
  'boolean',
  'date',
  'unknown'
] as const

export type UIPluginFieldType = (typeof UI_PLUGIN_FIELD_TYPES)[number]

export interface PluginInputDefinition {
  key: string
  label: string
  labelKey?: string
  type: UIPluginInputType
  required?: boolean
  description?: string
  descriptionKey?: string
  compatibleFieldTypes?: UIPluginFieldType[]
}

export interface UIPluginDefinition {
  id: string
  name: string
  nameKey?: string
  description?: string
  descriptionKey?: string
  component: Component
  inputSchema: PluginInputDefinition[]
}

export interface UIPluginFieldOption {
  label: string
  value: string
  fieldType: UIPluginFieldType
}

const ISO_DATE_VALUE_PATTERN = /^\d{4}-\d{2}-\d{2}(?:[T\s]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,6})?)?(?:Z|[+-]\d{2}:\d{2})?)?$/

const inferValueType = (
  value: SavedSqlQueryResultValue
): UIPluginFieldType => {
  if (value === null) {
    return 'unknown'
  }

  if (typeof value === 'number') {
    return 'number'
  }

  if (typeof value === 'boolean') {
    return 'boolean'
  }

  if (
    typeof value === 'string' &&
    ISO_DATE_VALUE_PATTERN.test(value.trim())
  ) {
    return 'date'
  }

  return 'string'
}

export const inferUIPluginFieldType = (
  columnName: string,
  rows: SavedSqlQueryResultRow[]
): UIPluginFieldType => {
  const valueTypes = new Set<UIPluginFieldType>()

  for (const row of rows) {
    valueTypes.add(inferValueType(row[columnName] ?? null))
  }

  valueTypes.delete('unknown')

  if (valueTypes.size === 0) {
    return 'unknown'
  }

  if (valueTypes.size === 1) {
    return [...valueTypes][0] ?? 'unknown'
  }

  if (valueTypes.has('string')) {
    return 'string'
  }

  if (valueTypes.has('date')) {
    return valueTypes.size === 1
      ? 'date'
      : 'string'
  }

  return 'string'
}

export const buildUIPluginFieldOptions = (
  columns: string[],
  rows: SavedSqlQueryResultRow[]
): UIPluginFieldOption[] => {
  return columns.map((columnName) => {
    const type = inferUIPluginFieldType(columnName, rows)

    return {
      label: columnName,
      value: columnName,
      fieldType: type
    }
  })
}

export const filterUIPluginFieldOptions = (
  input: PluginInputDefinition,
  fieldOptions: UIPluginFieldOption[]
): UIPluginFieldOption[] => {
  if (!input.compatibleFieldTypes?.length) {
    return fieldOptions
  }

  return fieldOptions.filter((fieldOption) => {
    return (
      fieldOption.fieldType === 'unknown' ||
      input.compatibleFieldTypes?.includes(fieldOption.fieldType)
    )
  })
}

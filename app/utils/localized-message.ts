import { APPLICATION_MESSAGE_KEYS } from '#shared/i18n/message-keys'

export type InterfaceTranslator = (key: string, parameters?: Record<string, unknown>) => string

/** Localize authored feedback; preserve provider/database diagnostics and user data. */
export const localizeAppMessage = (translate: InterfaceTranslator, value: unknown): string => {
  if (typeof value !== 'string') return ''
  const key = APPLICATION_MESSAGE_KEYS[value]
  if (key) return translate(key)
  if (/^(errors|queries|connections|pages|interface)\.[\w.]+$/.test(value)) return translate(value)
  const modelLabel = value.match(/^(.*) · ~(\d+) MB GPU( · cached)?$/)
  if (modelLabel) return translate('interface.browserModelLabel', {
    model: modelLabel[1], memory: modelLabel[2], cached: modelLabel[3] ? translate('interface.cachedModelSuffix') : ''
  })
  for (const [source, messageKey] of Object.entries(APPLICATION_MESSAGE_KEYS)) {
    if (!source.endsWith(' {details}')) continue
    const prefix = source.slice(0, -10)
    if (value.startsWith(prefix)) return translate(messageKey, { details: localizeAppMessage(translate, value.slice(prefix.length).trim()) })
  }
  return value
}

export const localizeModelOptions = <T extends { label: string }>(translate: InterfaceTranslator, items: T[]): T[] =>
  items.map(item => ({ ...item, label: localizeAppMessage(translate, item.label) }))

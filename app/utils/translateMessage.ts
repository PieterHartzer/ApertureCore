import type { ComposerTranslation } from 'vue-i18n'

export const translateMessage = (
  t: ComposerTranslation,
  messageKey: string | undefined,
  fallbackMessage: string
) => {
  if (!messageKey) {
    return fallbackMessage
  }

  const translatedMessage = t(messageKey)

  return translatedMessage === messageKey ? fallbackMessage : translatedMessage
}

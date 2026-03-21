type TranslateMessageFn = (key: string) => string

/**
 * Resolves an API-provided i18n key using the active locale and its configured
 * fallback chain, then falls back to a safe local message key instead of the
 * raw API message text.
 */
export const translateMessage = (
  t: TranslateMessageFn,
  messageKey: string | undefined,
  fallbackKey: string
) => {
  const safeFallbackMessage = t(fallbackKey)

  if (!messageKey) {
    return safeFallbackMessage
  }

  const translatedMessage = t(messageKey)

  return translatedMessage === messageKey
    ? safeFallbackMessage
    : translatedMessage
}

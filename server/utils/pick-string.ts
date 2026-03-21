/**
 * Returns the first non-empty string from the provided values after trimming it.
 */
export const pickString = (...values: unknown[]): string | undefined => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }

  return undefined
}

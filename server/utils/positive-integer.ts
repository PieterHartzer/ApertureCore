/**
 * Returns the provided positive integer when valid, otherwise the fallback.
 * String inputs are trimmed and parsed as base-10 integers.
 */
export const resolvePositiveInteger = (
  value: unknown,
  fallback: number
) => {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return value
  }

  if (typeof value === 'string' && value.trim()) {
    const parsedValue = Number.parseInt(value, 10)

    if (Number.isInteger(parsedValue) && parsedValue > 0) {
      return parsedValue
    }
  }

  return fallback
}

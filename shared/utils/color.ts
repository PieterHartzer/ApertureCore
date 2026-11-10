/** Six-digit hex, or eight digits when the colour is partly transparent. */
const HEX_COLOR = /^#(?:[0-9a-f]{6}|[0-9a-f]{8})$/i

export const isHexColor = (value: unknown): value is string => {
  return typeof value === 'string' && HEX_COLOR.test(value)
}

/** Splits a stored colour into its solid part and an opacity from 0 to 100. */
export const splitHexColor = (value: string) => {
  const solid = value.slice(0, 7).toLowerCase()
  const alpha = value.length === 9 ? parseInt(value.slice(7), 16) : 255

  return { solid, opacity: Math.round(alpha / 255 * 100) }
}

/** Fully opaque colours keep the short form, so existing values don't change. */
export const joinHexColor = (solid: string, opacity: number) => {
  const percent = Math.min(100, Math.max(0, Math.round(opacity)))

  if (percent >= 100) {
    return solid.toLowerCase()
  }

  return `${solid.toLowerCase()}${Math.round(percent / 100 * 255).toString(16).padStart(2, '0')}`
}

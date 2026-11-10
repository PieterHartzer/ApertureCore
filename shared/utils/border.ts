export const BORDER_STYLES = ['solid', 'dashed', 'dotted', 'double'] as const

export type BorderStyle = typeof BORDER_STYLES[number]

export const isBorderStyle = (value: unknown): value is BorderStyle => {
  return typeof value === 'string' && (BORDER_STYLES as readonly string[]).includes(value)
}

/**
 * Draws a border inside the card with an outline, so it follows the corner
 * radius and never changes the card's size.
 */
export const outlineDeclarations = (width: number, style: BorderStyle, color: string) => {
  const safeWidth = Math.min(Math.max(width, 0), 8)

  return {
    outline: `${safeWidth}px ${style} ${color}`,
    outlineOffset: `-${safeWidth}px`
  }
}

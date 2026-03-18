import { describe, expect, it, vi } from 'vitest'

import { translateMessage } from '../../../app/utils/translateMessage'

describe('translateMessage', () => {
  it('returns the fallback message when no message key is provided', () => {
    const t = vi.fn()

    expect(translateMessage(t, undefined, 'Fallback')).toBe('Fallback')
    expect(t).not.toHaveBeenCalled()
  })

  it('returns the translated message when the key exists', () => {
    const t = vi.fn((key: string) => {
      return key === 'connections.test.success' ? 'Translated success' : key
    })

    expect(
      translateMessage(t, 'connections.test.success', 'Fallback')
    ).toBe('Translated success')
  })

  it('falls back to the original message when the translation key is missing', () => {
    const t = vi.fn((key: string) => key)

    expect(
      translateMessage(t, 'connections.test.unknown', 'Fallback')
    ).toBe('Fallback')
  })
})

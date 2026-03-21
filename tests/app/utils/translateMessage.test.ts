import { describe, expect, it, vi } from 'vitest'

import { translateMessage } from '../../../app/utils/translateMessage'

describe('translateMessage', () => {
  it('returns the translated fallback key when no message key is provided', () => {
    const t = vi.fn((key: string) => {
      return key === 'connections.test.errors.unexpected'
        ? 'Unexpected error'
        : key
    })

    expect(
      translateMessage(t, undefined, 'connections.test.errors.unexpected')
    ).toBe('Unexpected error')
  })

  it('returns the translated message when the key exists', () => {
    const t = vi.fn((key: string) => {
      return key === 'connections.test.success' ? 'Translated success' : key
    })

    expect(
      translateMessage(
        t,
        'connections.test.success',
        'connections.test.errors.unexpected'
      )
    ).toBe('Translated success')
  })

  it('falls back to the translated fallback key when the message key is missing', () => {
    const t = vi.fn((key: string) => {
      return key === 'connections.test.errors.unexpected'
        ? 'Unexpected error'
        : key
    })

    expect(
      translateMessage(
        t,
        'connections.test.unknown',
        'connections.test.errors.unexpected'
      )
    ).toBe('Unexpected error')
  })
})

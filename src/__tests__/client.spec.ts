import { describe, expect, it } from 'vitest'

import { ApiError, FormError, getErrorMessage, parseFilename } from '@/api/client'

describe('parseFilename', () => {
  it('reads a plain quoted filename', () => {
    expect(parseFilename('attachment; filename="lab-result.pdf"')).toBe('lab-result.pdf')
  })

  it('prefers the RFC 5987 form Django sends for non-ASCII names', () => {
    expect(parseFilename("attachment; filename*=utf-8''hasil%20lab%20%E2%80%93%20Mei.pdf")).toBe(
      'hasil lab – Mei.pdf',
    )
  })

  it('returns null without a filename', () => {
    expect(parseFilename('attachment')).toBeNull()
  })
})

describe('getErrorMessage', () => {
  it('shows browser-side form errors as written', () => {
    expect(getErrorMessage(new FormError('The two passwords are different.'), 'fallback')).toBe(
      'The two passwords are different.',
    )
  })

  it('shows API messages and hides unknown errors', () => {
    expect(getErrorMessage(new ApiError(403, 'Wrong share key.'), 'fallback')).toBe('Wrong share key.')
    expect(getErrorMessage(new TypeError('Failed to fetch'), 'fallback')).toBe('fallback')
  })
})

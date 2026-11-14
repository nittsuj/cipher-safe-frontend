import { describe, expect, it } from 'vitest'

import { FILE_CATEGORIES } from '@/config/records'
import { categoryLabel, formatFingerprint } from '@/utils/format'

describe('categoryLabel', () => {
  it('uses the label from FILE_CATEGORIES for every category', () => {
    for (const category of FILE_CATEGORIES)
      expect(categoryLabel(category.value)).toBe(category.label)
  })

  it('falls back to the raw value for an unknown category', () => {
    expect(categoryLabel('XRAY')).toBe('XRAY')
  })
})

describe('formatFingerprint', () => {
  it('shows uppercase groups of four', () => {
    expect(formatFingerprint('3f:a1:00:ff:12')).toBe('3FA1 00FF 12')
  })

  it('formats a full SHA-256 fingerprint as 16 groups', () => {
    const bytes = Array.from({ length: 32 }, (_, i) => i.toString(16).padStart(2, '0'))
    const fingerprint = bytes.join(':')
    const groups = formatFingerprint(fingerprint).split(' ')
    expect(groups).toHaveLength(16)
    expect(groups.every((group) => /^[0-9A-F]{4}$/.test(group))).toBe(true)
  })

  it('returns an empty string for an empty fingerprint', () => {
    expect(formatFingerprint('')).toBe('')
  })
})

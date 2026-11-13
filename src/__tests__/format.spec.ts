import { describe, expect, it } from 'vitest'

import { FILE_CATEGORIES } from '@/config/records'
import { categoryLabel } from '@/utils/format'

describe('categoryLabel', () => {
  it('uses the label from FILE_CATEGORIES for every category', () => {
    for (const category of FILE_CATEGORIES)
      expect(categoryLabel(category.value)).toBe(category.label)
  })

  it('falls back to the raw value for an unknown category', () => {
    expect(categoryLabel('XRAY')).toBe('XRAY')
  })
})

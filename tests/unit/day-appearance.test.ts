import { describe, expect, it } from 'vitest'
import { getDayAppearance, hasReflection } from '../../shared/utils/day-appearance'

describe('getDayAppearance', () => {
  it('returns unrecorded when there is no entry', () => {
    expect(getDayAppearance(undefined)).toBe('unrecorded')
    expect(getDayAppearance(null)).toBe('unrecorded')
  })

  it('returns completed for a completed day', () => {
    expect(getDayAppearance({ status: 'completed', reflection: null })).toBe('completed')
  })

  it('keeps completed even when a reflection exists', () => {
    expect(getDayAppearance({
      status: 'completed',
      reflection: '今天比想象中容易。',
    })).toBe('completed')
  })

  it('returns missed for a missed day without reflection', () => {
    expect(getDayAppearance({ status: 'missed', reflection: null })).toBe('missed')
    expect(getDayAppearance({ status: 'missed', reflection: '' })).toBe('missed')
    expect(getDayAppearance({ status: 'missed', reflection: '   \n  ' })).toBe('missed')
  })

  it('returns reflected-miss for a missed day with a reflection', () => {
    expect(getDayAppearance({
      status: 'missed',
      reflection: '晚上刷手机的时间比预期长。',
    })).toBe('reflected-miss')
  })
})

describe('hasReflection', () => {
  it('ignores whitespace-only reflections', () => {
    expect(hasReflection({ status: 'missed', reflection: '  ' })).toBe(false)
    expect(hasReflection({ status: 'missed', reflection: '有内容' })).toBe(true)
    expect(hasReflection(null)).toBe(false)
  })
})

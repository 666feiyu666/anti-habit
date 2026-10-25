import { describe, expect, it } from 'vitest'
import {
  daysBetweenDateOnly,
  isValidDateOnly,
  parseDateOnly,
  todayDateOnly,
} from '../../shared/utils/date'

describe('date-only helpers', () => {
  it('accepts valid calendar dates', () => {
    expect(isValidDateOnly('2026-10-25')).toBe(true)
    expect(isValidDateOnly('2028-02-29')).toBe(true)
  })

  it('rejects malformed or impossible dates', () => {
    expect(isValidDateOnly('2026-2-5')).toBe(false)
    expect(isValidDateOnly('2026-13-01')).toBe(false)
    expect(isValidDateOnly('2026-02-29')).toBe(false)
    expect(isValidDateOnly('2026-04-31')).toBe(false)
    expect(isValidDateOnly('not-a-date')).toBe(false)
  })

  it('parses date parts without timezone conversion', () => {
    expect(parseDateOnly('2026-10-25')).toEqual({ year: 2026, month: 10, day: 25 })
  })

  it('builds the local calendar day with zero padding', () => {
    expect(todayDateOnly(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05')
    expect(todayDateOnly(new Date(2026, 11, 31, 0, 1))).toBe('2026-12-31')
  })

  it('measures day differences across month and DST boundaries', () => {
    expect(daysBetweenDateOnly('2026-10-01', '2026-10-31')).toBe(30)
    expect(daysBetweenDateOnly('2026-03-01', '2026-04-01')).toBe(31)
    expect(daysBetweenDateOnly('2026-10-31', '2026-10-01')).toBe(-30)
    expect(daysBetweenDateOnly('bad', '2026-10-01')).toBeNull()
  })
})

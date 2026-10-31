import { describe, expect, it } from 'vitest'
import type { EntryStatus } from '../../shared/types'
import { computeGoalTargetProgress } from '../../shared/utils/goal-target'

function statusMap(entries: Record<string, EntryStatus>): Map<string, EntryStatus> {
  return new Map(Object.entries(entries))
}

describe('goal target progress', () => {
  const statuses = statusMap({
    '2026-09-30': 'completed',
    '2026-10-01': 'completed',
    '2026-10-02': 'completed',
    '2026-10-03': 'missed',
    '2026-10-04': 'completed',
    '2026-10-05': 'completed',
    '2026-10-06': 'completed',
    '2026-10-08': 'completed',
    '2026-10-09': 'completed',
  })

  it('computes longest and current streaks from the goal start date', () => {
    const progress = computeGoalTargetProgress({
      type: 'streak',
      count: 3,
      startDate: '2026-10-01',
      today: '2026-10-10',
      statuses,
    })

    expect(progress).toEqual({
      startDate: '2026-10-01',
      completedDays: 7,
      currentStreak: 2,
      longestStreak: 3,
      achieved: true,
      achievedOn: '2026-10-06',
    })
  })

  it('keeps the current streak from yesterday when today is not recorded yet', () => {
    const progress = computeGoalTargetProgress({
      type: 'streak',
      count: 30,
      startDate: '2026-10-01',
      today: '2026-10-10',
      statuses,
    })

    expect(progress.currentStreak).toBe(2)
    expect(progress.achieved).toBe(false)
    expect(progress.achievedOn).toBeNull()
  })

  it('resets the current streak when today is marked missed', () => {
    const progress = computeGoalTargetProgress({
      type: 'streak',
      count: 30,
      startDate: '2026-10-01',
      today: '2026-10-10',
      statuses: statusMap({
        ...Object.fromEntries(statuses),
        '2026-10-10': 'missed',
      }),
    })

    expect(progress.currentStreak).toBe(0)
    expect(progress.longestStreak).toBe(3)
  })

  it('counts cumulative completed days and their achievement date', () => {
    const progress = computeGoalTargetProgress({
      type: 'cumulative',
      count: 5,
      startDate: '2026-10-01',
      today: '2026-10-10',
      statuses,
    })

    expect(progress.completedDays).toBe(7)
    expect(progress.currentStreak).toBe(2)
    expect(progress.longestStreak).toBe(3)
    expect(progress.achieved).toBe(true)
    expect(progress.achievedOn).toBe('2026-10-06')
  })

  it('ignores days before the start date and handles empty histories', () => {
    const beforeStart = computeGoalTargetProgress({
      type: 'cumulative',
      count: 1,
      startDate: '2026-10-01',
      today: '2026-10-01',
      statuses: statusMap({ '2026-09-30': 'completed' }),
    })
    expect(beforeStart.completedDays).toBe(0)
    expect(beforeStart.achieved).toBe(false)

    const empty = computeGoalTargetProgress({
      type: 'streak',
      count: 1,
      startDate: '2026-10-01',
      today: '2026-10-10',
      statuses: new Map(),
    })
    expect(empty).toMatchObject({
      completedDays: 0,
      currentStreak: 0,
      longestStreak: 0,
      achieved: false,
      achievedOn: null,
    })
  })
})

import type { EntryStatus, GoalTargetProgress, GoalTargetType } from '../types'
import { parseDateOnly } from './date'

export interface GoalTargetProgressInput {
  type: GoalTargetType
  count: number
  startDate: string
  today: string
  statuses: ReadonlyMap<string, EntryStatus>
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function dateKeyFromUtc(timestamp: number): string {
  const date = new Date(timestamp)
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
}

function eachDateBetween(startDate: string, endDate: string): string[] {
  const start = parseDateOnly(startDate)
  const end = parseDateOnly(endDate)
  if (!start || !end) return []

  const startTime = Date.UTC(start.year, start.month - 1, start.day)
  const endTime = Date.UTC(end.year, end.month - 1, end.day)
  const days: string[] = []

  for (let time = startTime; time <= endTime; time += 86_400_000) {
    days.push(dateKeyFromUtc(time))
  }

  return days
}

export function computeGoalTargetProgress(
  input: GoalTargetProgressInput,
): GoalTargetProgress {
  const days = eachDateBetween(input.startDate, input.today)

  let completedDays = 0
  let runningStreak = 0
  let longestStreak = 0
  let achievedOn: string | null = null

  for (const date of days) {
    if (input.statuses.get(date) !== 'completed') {
      runningStreak = 0
      continue
    }

    completedDays += 1
    runningStreak += 1
    longestStreak = Math.max(longestStreak, runningStreak)

    if (achievedOn === null) {
      if (input.type === 'streak' && runningStreak >= input.count) {
        achievedOn = date
      } else if (input.type === 'cumulative' && completedDays >= input.count) {
        achievedOn = date
      }
    }
  }

  let currentStreak = 0
  let cursor = days.length - 1

  // 今天还没记录时，不把当前连续立即清零；从昨天开始往回数。
  if (cursor >= 0 && input.statuses.get(days[cursor]!) === undefined) {
    cursor -= 1
  }

  while (cursor >= 0 && input.statuses.get(days[cursor]!) === 'completed') {
    currentStreak += 1
    cursor -= 1
  }

  const achieved = input.type === 'streak'
    ? longestStreak >= input.count
    : completedDays >= input.count

  return {
    startDate: input.startDate,
    completedDays,
    currentStreak,
    longestStreak,
    achieved,
    achievedOn: achieved ? achievedOn : null,
  }
}

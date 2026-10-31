import { and, asc, eq, gte, isNull, lte } from 'drizzle-orm'
import type { GoalTarget } from '~~/shared/types'
import { todayDateOnly } from '~~/shared/utils/date'
import { computeGoalTargetProgress } from '~~/shared/utils/goal-target'
import {
  dailyEntries,
  goalTargets,
  type GoalRow,
  type GoalTargetRow,
} from '../database/schema'
import type { AppDatabase } from './db'
import { apiError } from './http'

function attachProgress(
  db: AppDatabase,
  goal: GoalRow,
  rows: GoalTargetRow[],
): GoalTarget[] {
  if (rows.length === 0) return []

  const today = todayDateOnly()
  const startDate = todayDateOnly(new Date(goal.createdAt * 1000))
  const entries = db
    .select({
      entryDate: dailyEntries.entryDate,
      status: dailyEntries.status,
    })
    .from(dailyEntries)
    .where(and(
      eq(dailyEntries.goalId, goal.id),
      isNull(dailyEntries.deletedAt),
      gte(dailyEntries.entryDate, startDate),
      lte(dailyEntries.entryDate, today),
    ))
    .all()

  const statuses = new Map(entries.map(entry => [entry.entryDate, entry.status]))

  return rows.map(row => ({
    id: row.id,
    goalId: row.goalId,
    type: row.type,
    count: row.count,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    progress: computeGoalTargetProgress({
      type: row.type,
      count: row.count,
      startDate,
      today,
      statuses,
    }),
  }))
}

export function getGoalTargets(db: AppDatabase, goal: GoalRow): GoalTarget[] {
  const rows = db
    .select()
    .from(goalTargets)
    .where(eq(goalTargets.goalId, goal.id))
    .orderBy(asc(goalTargets.createdAt), asc(goalTargets.id))
    .all()

  return attachProgress(db, goal, rows)
}

export function getGoalTarget(
  db: AppDatabase,
  goal: GoalRow,
  targetId: string,
): GoalTarget | null {
  const [row] = db
    .select()
    .from(goalTargets)
    .where(and(
      eq(goalTargets.id, targetId),
      eq(goalTargets.goalId, goal.id),
    ))
    .limit(1)
    .all()

  if (!row) return null
  return attachProgress(db, goal, [row])[0] ?? null
}

export function requireGoalTarget(
  db: AppDatabase,
  goalId: string,
  targetId: string | undefined,
): GoalTargetRow {
  if (!targetId) {
    throw apiError(404, 'GOAL_TARGET_NOT_FOUND', '目标设定不存在')
  }

  const [target] = db
    .select()
    .from(goalTargets)
    .where(and(
      eq(goalTargets.id, targetId),
      eq(goalTargets.goalId, goalId),
    ))
    .limit(1)
    .all()

  if (!target) {
    throw apiError(404, 'GOAL_TARGET_NOT_FOUND', '目标设定不存在')
  }

  return target
}

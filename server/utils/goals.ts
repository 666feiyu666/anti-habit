import { and, eq, isNull, ne, sql } from 'drizzle-orm'
import type { AppDatabase } from './db'
import { goals } from '../database/schema'
import { apiError } from './http'

export async function requireActiveGoal(db: AppDatabase, id: string | undefined) {
  if (!id) {
    throw apiError(404, 'GOAL_NOT_FOUND', '目标不存在或已被删除')
  }

  const [goal] = await db
    .select()
    .from(goals)
    .where(and(eq(goals.id, id), isNull(goals.deletedAt)))
    .limit(1)

  if (!goal) {
    throw apiError(404, 'GOAL_NOT_FOUND', '目标不存在或已被删除')
  }

  return goal
}

export async function assertTitleAvailable(
  db: AppDatabase,
  title: string,
  excludeId?: string,
) {
  const [existing] = await db
    .select({ id: goals.id })
    .from(goals)
    .where(and(
      isNull(goals.deletedAt),
      sql`lower(${goals.title}) = lower(${title})`,
      excludeId ? ne(goals.id, excludeId) : undefined,
    ))
    .limit(1)

  if (existing) {
    throw apiError(409, 'GOAL_TITLE_EXISTS', '已有同名目标，请换一个名称')
  }
}

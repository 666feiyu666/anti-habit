import { and, eq, isNull } from 'drizzle-orm'
import { goals } from '../../../database/schema'
import { getDatabase } from '../../../utils/db'
import { requireActiveGoal } from '../../../utils/goals'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const db = getDatabase()
  await requireActiveGoal(db, id)

  const now = Math.floor(Date.now() / 1000)
  await db
    .update(goals)
    .set({ deletedAt: now, updatedAt: now })
    .where(and(eq(goals.id, id!), isNull(goals.deletedAt)))

  return { deleted: true }
})

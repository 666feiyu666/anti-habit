import { and, eq, isNull } from 'drizzle-orm'
import { dailyEntries } from '../../../../database/schema'
import { getDatabase } from '../../../../utils/db'
import { requireActiveGoal } from '../../../../utils/goals'
import { readDateParam } from '../../../../utils/http'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const entryDate = readDateParam(event)
  const db = getDatabase()
  await requireActiveGoal(db, id)

  const now = Math.floor(Date.now() / 1000)
  await db
    .update(dailyEntries)
    .set({ deletedAt: now, updatedAt: now })
    .where(and(
      eq(dailyEntries.goalId, id!),
      eq(dailyEntries.entryDate, entryDate),
      isNull(dailyEntries.deletedAt),
    ))

  return { deleted: true }
})

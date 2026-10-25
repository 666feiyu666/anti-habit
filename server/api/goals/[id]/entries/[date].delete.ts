import { and, eq } from 'drizzle-orm'
import { dailyEntries } from '../../../../database/schema'
import { getDatabase } from '../../../../utils/db'
import { requireActiveGoal } from '../../../../utils/goals'
import { readDateParam } from '../../../../utils/http'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const entryDate = readDateParam(event)
  const db = getDatabase()
  await requireActiveGoal(db, id)

  await db
    .delete(dailyEntries)
    .where(and(
      eq(dailyEntries.goalId, id!),
      eq(dailyEntries.entryDate, entryDate),
    ))

  return { deleted: true }
})

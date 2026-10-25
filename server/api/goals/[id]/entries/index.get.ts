import { and, asc, eq, gte, lte } from 'drizzle-orm'
import { dailyEntries } from '../../../../database/schema'
import { getDatabase } from '../../../../utils/db'
import { requireActiveGoal } from '../../../../utils/goals'
import { readDateRange } from '../../../../utils/http'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const db = getDatabase()
  await requireActiveGoal(db, id)

  const { from, to } = readDateRange(event)
  const entries = await db
    .select()
    .from(dailyEntries)
    .where(and(
      eq(dailyEntries.goalId, id!),
      gte(dailyEntries.entryDate, from),
      lte(dailyEntries.entryDate, to),
    ))
    .orderBy(asc(dailyEntries.entryDate))

  return { entries }
})

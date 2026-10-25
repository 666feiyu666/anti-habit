import { and, asc, eq, gte, isNull, lte } from 'drizzle-orm'
import { dailyEntries } from '../../../../database/schema'
import { getDatabase } from '../../../../utils/db'
import { attachLinkedEntryIds } from '../../../../utils/essays'
import { requireActiveGoal } from '../../../../utils/goals'
import { readDateRange } from '../../../../utils/http'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const db = getDatabase()
  await requireActiveGoal(db, id)

  const { from, to } = readDateRange(event)
  const entries = db
    .select()
    .from(dailyEntries)
    .where(and(
      eq(dailyEntries.goalId, id!),
      gte(dailyEntries.entryDate, from),
      lte(dailyEntries.entryDate, to),
      isNull(dailyEntries.deletedAt),
    ))
    .orderBy(asc(dailyEntries.entryDate))
    .all()

  return { entries: attachLinkedEntryIds(db, entries) }
})

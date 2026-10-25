import { and, asc, eq, isNull } from 'drizzle-orm'
import { goals, dailyEntries } from '../../database/schema'
import { getDatabase } from '../../utils/db'
import { readDateQuery } from '../../utils/http'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const date = query.date === undefined ? null : readDateQuery(query.date, 'date')
  const db = getDatabase()

  if (!date) {
    const rows = await db
      .select()
      .from(goals)
      .where(isNull(goals.deletedAt))
      .orderBy(asc(goals.createdAt), asc(goals.id))

    return {
      goals: rows.map(goal => ({ ...goal, todayEntry: null })),
    }
  }

  const rows = await db
    .select({ goal: goals, entry: dailyEntries })
    .from(goals)
    .leftJoin(dailyEntries, and(
      eq(dailyEntries.goalId, goals.id),
      eq(dailyEntries.entryDate, date),
      isNull(dailyEntries.deletedAt),
    ))
    .where(isNull(goals.deletedAt))
    .orderBy(asc(goals.createdAt), asc(goals.id))

  return {
    goals: rows.map(({ goal, entry }) => ({ ...goal, todayEntry: entry ?? null })),
  }
})

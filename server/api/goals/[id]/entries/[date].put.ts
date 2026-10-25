import { randomUUID } from 'node:crypto'
import { upsertEntrySchema } from '~~/shared/schemas'
import { todayDateOnly } from '~~/shared/utils/date'
import { dailyEntries } from '../../../../database/schema'
import { getDatabase } from '../../../../utils/db'
import { requireActiveGoal } from '../../../../utils/goals'
import { apiError, parseBody, readDateParam } from '../../../../utils/http'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const entryDate = readDateParam(event)
  const db = getDatabase()
  await requireActiveGoal(db, id)

  if (entryDate > todayDateOnly()) {
    throw apiError(400, 'FUTURE_DATE', '不能记录未来的日期')
  }

  const { status, reflection } = await parseBody(event, upsertEntrySchema)
  const now = Math.floor(Date.now() / 1000)

  const [entry] = await db
    .insert(dailyEntries)
    .values({
      id: randomUUID(),
      goalId: id!,
      entryDate,
      status,
      reflection,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [dailyEntries.goalId, dailyEntries.entryDate],
      set: {
        status,
        reflection,
        updatedAt: now,
      },
    })
    .returning()

  return { entry }
})

import { randomUUID } from 'node:crypto'
import { and, eq, inArray, isNull } from 'drizzle-orm'
import { upsertEntrySchema } from '~~/shared/schemas'
import { todayDateOnly } from '~~/shared/utils/date'
import { dailyEntries, entryLinks } from '../../../../database/schema'
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

  const { status, reflection, linkedEntryIds } = await parseBody(event, upsertEntrySchema)
  const now = Math.floor(Date.now() / 1000)

  const result = db.transaction((tx) => {
    const [existingSource] = tx
      .select({ id: dailyEntries.id })
      .from(dailyEntries)
      .where(and(
        eq(dailyEntries.goalId, id!),
        eq(dailyEntries.entryDate, entryDate),
      ))
      .all()

    const existingLinkIds = existingSource
      ? tx
          .select({ targetEntryId: entryLinks.targetEntryId })
          .from(entryLinks)
          .where(eq(entryLinks.sourceEntryId, existingSource.id))
          .all()
          .map(link => link.targetEntryId)
      : []

    if (linkedEntryIds && linkedEntryIds.length > 0) {
      const targets = tx
        .select()
        .from(dailyEntries)
        .where(inArray(dailyEntries.id, linkedEntryIds))
        .all()

      if (targets.length !== linkedEntryIds.length) {
        throw apiError(400, 'INVALID_LINK', '关联的记录不存在')
      }

      for (const target of targets) {
        if (target.goalId !== id) {
          throw apiError(400, 'INVALID_LINK', '不能关联其他目标的记录')
        }
        if (target.deletedAt !== null && !existingLinkIds.includes(target.id)) {
          throw apiError(400, 'INVALID_LINK', '不能关联已删除的记录')
        }
        if (target.entryDate >= entryDate) {
          throw apiError(400, 'INVALID_LINK', '只能回应更早的日期')
        }
      }
    }

    const [entry] = tx
      .insert(dailyEntries)
      .values({
        id: randomUUID(),
        goalId: id!,
        entryDate,
        status,
        reflection,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      })
      .onConflictDoUpdate({
        target: [dailyEntries.goalId, dailyEntries.entryDate],
        set: {
          status,
          reflection,
          updatedAt: now,
          deletedAt: null,
        },
      })
      .returning()
      .all()

    if (!entry) {
      throw apiError(500, 'ENTRY_SAVE_FAILED', '记录没有保存成功')
    }

    if (linkedEntryIds !== undefined) {
      tx.delete(entryLinks)
        .where(eq(entryLinks.sourceEntryId, entry.id))
        .run()

      if (linkedEntryIds.length > 0) {
        tx.insert(entryLinks)
          .values(linkedEntryIds.map(targetEntryId => ({
            sourceEntryId: entry.id,
            targetEntryId,
            createdAt: now,
          })))
          .run()
      }
    }

    return {
      entry,
      linkedEntryIds: linkedEntryIds ?? existingLinkIds,
    }
  })

  return {
    entry: {
      ...result.entry,
      linkedEntryIds: result.linkedEntryIds,
    },
  }
})

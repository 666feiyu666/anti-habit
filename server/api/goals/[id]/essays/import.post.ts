import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { importEssaySchema } from '~~/shared/schemas'
import { isValidDateOnly, todayDateOnly } from '~~/shared/utils/date'
import { dailyEntries, entryLinks } from '../../../../database/schema'
import { getDatabase } from '../../../../utils/db'
import { requireActiveGoal } from '../../../../utils/goals'
import { apiError, parseBody } from '../../../../utils/http'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const db = getDatabase()
  await requireActiveGoal(db, id)

  const { entries } = await parseBody(event, importEssaySchema)
  const today = todayDateOnly()
  const seen = new Set<string>()

  for (const entry of entries) {
    if (!isValidDateOnly(entry.entryDate)) {
      throw apiError(400, 'INVALID_DATE', `导入的日期 ${entry.entryDate} 无效`)
    }
    if (entry.entryDate > today) {
      throw apiError(400, 'FUTURE_DATE', '不能导入未来的日期')
    }
    if (seen.has(entry.entryDate)) {
      throw apiError(400, 'DUPLICATE_DATE', `日期 ${entry.entryDate} 出现了两次`)
    }
    seen.add(entry.entryDate)
  }

  const now = Math.floor(Date.now() / 1000)

  const imported = db.transaction((tx) => {
    const saved = entries.map((entry) => {
      const [row] = tx
        .insert(dailyEntries)
        .values({
          id: randomUUID(),
          goalId: id!,
          entryDate: entry.entryDate,
          status: entry.status,
          reflection: entry.reflection,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
        })
        .onConflictDoUpdate({
          target: [dailyEntries.goalId, dailyEntries.entryDate],
          set: {
            status: entry.status,
            reflection: entry.reflection,
            updatedAt: now,
            deletedAt: null,
          },
        })
        .returning()
        .all()

      if (!row) {
        throw apiError(500, 'ENTRY_IMPORT_FAILED', '导入没有完成')
      }

      return { entry, row }
    })

    const allRows = tx
      .select()
      .from(dailyEntries)
      .where(eq(dailyEntries.goalId, id!))
      .all()
    const byDate = new Map(allRows.map(row => [row.entryDate, row]))

    for (const item of saved) {
      const targetIds: string[] = []

      for (const date of item.entry.linkedEntryDates) {
        const target = byDate.get(date)
        if (!target) {
          throw apiError(400, 'INVALID_LINK', `关联的日期 ${date} 不存在`)
        }
        if (target.deletedAt !== null) {
          throw apiError(400, 'INVALID_LINK', '不能关联已删除的记录')
        }
        if (target.entryDate >= item.entry.entryDate) {
          throw apiError(400, 'INVALID_LINK', '只能回应更早的日期')
        }
        targetIds.push(target.id)
      }

      tx.delete(entryLinks)
        .where(eq(entryLinks.sourceEntryId, item.row.id))
        .run()

      if (targetIds.length > 0) {
        tx.insert(entryLinks)
          .values([...new Set(targetIds)].map(targetEntryId => ({
            sourceEntryId: item.row.id,
            targetEntryId,
            createdAt: now,
          })))
          .run()
      }
    }

    return saved.length
  })

  return { imported }
})

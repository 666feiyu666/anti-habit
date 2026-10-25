import { eq } from 'drizzle-orm'
import { updateGoalSchema } from '~~/shared/schemas'
import { goals } from '../../../database/schema'
import { getDatabase } from '../../../utils/db'
import { assertTitleAvailable, requireActiveGoal } from '../../../utils/goals'
import { parseBody } from '../../../utils/http'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const db = getDatabase()
  await requireActiveGoal(db, id)

  const { title } = await parseBody(event, updateGoalSchema)
  await assertTitleAvailable(db, title, id)

  const [goal] = await db
    .update(goals)
    .set({ title, updatedAt: Math.floor(Date.now() / 1000) })
    .where(eq(goals.id, id!))
    .returning()

  return { goal }
})

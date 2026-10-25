import { randomUUID } from 'node:crypto'
import { createGoalSchema } from '~~/shared/schemas'
import { goals } from '../../database/schema'
import { getDatabase } from '../../utils/db'
import { assertTitleAvailable } from '../../utils/goals'
import { parseBody } from '../../utils/http'

export default defineEventHandler(async (event) => {
  const { title } = await parseBody(event, createGoalSchema)
  const db = getDatabase()

  await assertTitleAvailable(db, title)

  const now = Math.floor(Date.now() / 1000)
  const [goal] = await db
    .insert(goals)
    .values({
      id: randomUUID(),
      title,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    })
    .returning()

  setResponseStatus(event, 201)
  return { goal }
})

import { randomUUID } from 'node:crypto'
import { createMaterialSchema } from '~~/shared/schemas'
import { goalMaterials } from '../../../../database/schema'
import { getDatabase } from '../../../../utils/db'
import { requireActiveGoal } from '../../../../utils/goals'
import { apiError, parseBody } from '../../../../utils/http'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const db = getDatabase()
  await requireActiveGoal(db, id)

  const { title, content, sourceName } = await parseBody(event, createMaterialSchema)
  const now = Math.floor(Date.now() / 1000)

  const [material] = await db
    .insert(goalMaterials)
    .values({
      id: randomUUID(),
      goalId: id!,
      title,
      content,
      sourceName,
      createdAt: now,
      updatedAt: now,
    })
    .returning()

  if (!material) {
    throw apiError(500, 'MATERIAL_CREATE_FAILED', '材料没有保存成功')
  }

  setResponseStatus(event, 201)
  return { material }
})

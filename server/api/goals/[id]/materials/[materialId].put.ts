import { and, eq } from 'drizzle-orm'
import { updateMaterialSchema } from '~~/shared/schemas'
import { goalMaterials } from '../../../../database/schema'
import { getDatabase } from '../../../../utils/db'
import { requireActiveGoal } from '../../../../utils/goals'
import { parseBody } from '../../../../utils/http'
import { requireMaterial } from '../../../../utils/materials'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const db = getDatabase()
  await requireActiveGoal(db, id)

  const materialId = getRouterParam(event, 'materialId')
  requireMaterial(db, id!, materialId)

  const { title, content } = await parseBody(event, updateMaterialSchema)
  const [material] = await db
    .update(goalMaterials)
    .set({
      title,
      content,
      updatedAt: Math.floor(Date.now() / 1000),
    })
    .where(and(
      eq(goalMaterials.id, materialId!),
      eq(goalMaterials.goalId, id!),
    ))
    .returning()

  return { material }
})

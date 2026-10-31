import { and, eq } from 'drizzle-orm'
import { goalMaterials } from '../../../../database/schema'
import { getDatabase } from '../../../../utils/db'
import { requireActiveGoal } from '../../../../utils/goals'
import { requireMaterial } from '../../../../utils/materials'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const db = getDatabase()
  await requireActiveGoal(db, id)

  const materialId = getRouterParam(event, 'materialId')
  requireMaterial(db, id!, materialId)

  await db
    .delete(goalMaterials)
    .where(and(
      eq(goalMaterials.id, materialId!),
      eq(goalMaterials.goalId, id!),
    ))

  return { deleted: true }
})

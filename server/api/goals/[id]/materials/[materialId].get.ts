import { getDatabase } from '../../../../utils/db'
import { requireActiveGoal } from '../../../../utils/goals'
import { requireMaterial } from '../../../../utils/materials'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const db = getDatabase()
  await requireActiveGoal(db, id)

  const material = requireMaterial(db, id!, getRouterParam(event, 'materialId'))
  return { material }
})

import { getDatabase } from '../../../../utils/db'
import { requireActiveGoal } from '../../../../utils/goals'
import { getMaterialSummaries } from '../../../../utils/materials'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const db = getDatabase()
  const goal = await requireActiveGoal(db, id)

  return { materials: getMaterialSummaries(db, goal.id) }
})

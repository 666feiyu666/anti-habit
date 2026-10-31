import { getDatabase } from '../../../../utils/db'
import { requireActiveGoal } from '../../../../utils/goals'
import { getGoalTargets } from '../../../../utils/targets'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const db = getDatabase()
  const goal = await requireActiveGoal(db, id)

  return { targets: getGoalTargets(db, goal) }
})

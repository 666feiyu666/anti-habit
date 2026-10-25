import { getDatabase } from '../../../utils/db'
import { requireActiveGoal } from '../../../utils/goals'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const goal = await requireActiveGoal(getDatabase(), id)
  return { goal }
})

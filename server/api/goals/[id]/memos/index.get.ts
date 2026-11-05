import { getDatabase } from '../../../../utils/db'
import { requireActiveGoal } from '../../../../utils/goals'
import { getGoalRelatedMemos } from '../../../../utils/memos'

export default defineEventHandler((event) => {
  const id = getRouterParam(event, 'id')
  const db = getDatabase()
  requireActiveGoal(db, id)

  return getGoalRelatedMemos(db, id!)
})

import { getDatabase } from '../../../../utils/db'
import { getEssayEntries } from '../../../../utils/essays'
import { requireActiveGoal } from '../../../../utils/goals'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const db = getDatabase()
  await requireActiveGoal(db, id)

  return { entries: getEssayEntries(db, id!) }
})

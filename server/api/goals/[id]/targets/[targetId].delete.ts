import { and, eq } from 'drizzle-orm'
import { goalTargets } from '../../../../database/schema'
import { getDatabase } from '../../../../utils/db'
import { requireActiveGoal } from '../../../../utils/goals'
import { requireGoalTarget } from '../../../../utils/targets'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const db = getDatabase()
  const goal = await requireActiveGoal(db, id)

  const targetId = getRouterParam(event, 'targetId')
  requireGoalTarget(db, goal.id, targetId)

  await db
    .delete(goalTargets)
    .where(and(
      eq(goalTargets.id, targetId!),
      eq(goalTargets.goalId, goal.id),
    ))

  return { deleted: true }
})

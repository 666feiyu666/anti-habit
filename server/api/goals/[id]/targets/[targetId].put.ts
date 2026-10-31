import { eq } from 'drizzle-orm'
import { updateGoalTargetSchema } from '~~/shared/schemas'
import { goalTargets } from '../../../../database/schema'
import { getDatabase } from '../../../../utils/db'
import { requireActiveGoal } from '../../../../utils/goals'
import { apiError, parseBody } from '../../../../utils/http'
import { getGoalTarget, requireGoalTarget } from '../../../../utils/targets'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const db = getDatabase()
  const goal = await requireActiveGoal(db, id)

  const targetId = getRouterParam(event, 'targetId')
  requireGoalTarget(db, goal.id, targetId)

  const { type, count } = await parseBody(event, updateGoalTargetSchema)
  await db
    .update(goalTargets)
    .set({
      type,
      count,
      updatedAt: Math.floor(Date.now() / 1000),
    })
    .where(eq(goalTargets.id, targetId!))

  const target = getGoalTarget(db, goal, targetId!)
  if (!target) {
    throw apiError(500, 'GOAL_TARGET_UPDATE_FAILED', '目标设定没有保存成功')
  }

  return { target }
})

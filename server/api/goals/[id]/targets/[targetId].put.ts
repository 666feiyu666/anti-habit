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
  const current = requireGoalTarget(db, goal.id, targetId)

  const { type, count, reward } = await parseBody(event, updateGoalTargetSchema)
  const nextReward = reward === undefined ? current.reward : reward
  const changed = type !== current.type
    || count !== current.count
    || nextReward !== current.reward

  await db
    .update(goalTargets)
    .set({
      type,
      count,
      reward: nextReward,
      rewardClaimedAt: changed ? null : current.rewardClaimedAt,
      updatedAt: Math.floor(Date.now() / 1000),
    })
    .where(eq(goalTargets.id, targetId!))

  const target = getGoalTarget(db, goal, targetId!)
  if (!target) {
    throw apiError(500, 'GOAL_TARGET_UPDATE_FAILED', '目标设定没有保存成功')
  }

  return { target }
})

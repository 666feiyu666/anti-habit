import { eq } from 'drizzle-orm'
import { updateGoalTargetRewardClaimSchema } from '~~/shared/schemas'
import { goalTargets } from '../../../../../database/schema'
import { getDatabase } from '../../../../../utils/db'
import { requireActiveGoal } from '../../../../../utils/goals'
import { apiError, parseBody } from '../../../../../utils/http'
import { getGoalTarget, requireGoalTarget } from '../../../../../utils/targets'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const db = getDatabase()
  const goal = await requireActiveGoal(db, id)

  const targetId = getRouterParam(event, 'targetId')
  requireGoalTarget(db, goal.id, targetId)

  const target = getGoalTarget(db, goal, targetId!)
  if (!target) {
    throw apiError(404, 'GOAL_TARGET_NOT_FOUND', '目标设定不存在')
  }

  const { claimed } = await parseBody(event, updateGoalTargetRewardClaimSchema)
  const now = Math.floor(Date.now() / 1000)

  if (claimed) {
    if (!target.reward) {
      throw apiError(400, 'TARGET_REWARD_MISSING', '这个目标设定还没有填写奖励')
    }
    if (!target.progress.achieved) {
      throw apiError(400, 'TARGET_NOT_ACHIEVED', '目标达成后才能领取奖励')
    }
  }

  await db
    .update(goalTargets)
    .set({
      rewardClaimedAt: claimed ? (target.rewardClaimedAt ?? now) : null,
      updatedAt: now,
    })
    .where(eq(goalTargets.id, targetId!))

  const updated = getGoalTarget(db, goal, targetId!)
  if (!updated) {
    throw apiError(500, 'GOAL_TARGET_UPDATE_FAILED', '奖励状态没有保存成功')
  }

  return { target: updated }
})

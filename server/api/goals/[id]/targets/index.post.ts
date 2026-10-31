import { randomUUID } from 'node:crypto'
import { createGoalTargetSchema } from '~~/shared/schemas'
import { goalTargets } from '../../../../database/schema'
import { getDatabase } from '../../../../utils/db'
import { requireActiveGoal } from '../../../../utils/goals'
import { apiError, parseBody } from '../../../../utils/http'
import { getGoalTarget } from '../../../../utils/targets'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const db = getDatabase()
  const goal = await requireActiveGoal(db, id)

  const { type, count, reward } = await parseBody(event, createGoalTargetSchema)
  const now = Math.floor(Date.now() / 1000)

  const [row] = await db
    .insert(goalTargets)
    .values({
      id: randomUUID(),
      goalId: goal.id,
      type,
      count,
      reward: reward ?? null,
      rewardClaimedAt: null,
      createdAt: now,
      updatedAt: now,
    })
    .returning()

  if (!row) {
    throw apiError(500, 'GOAL_TARGET_CREATE_FAILED', '目标设定没有保存成功')
  }

  const target = getGoalTarget(db, goal, row.id)
  if (!target) {
    throw apiError(500, 'GOAL_TARGET_CREATE_FAILED', '目标设定没有保存成功')
  }

  setResponseStatus(event, 201)
  return { target }
})

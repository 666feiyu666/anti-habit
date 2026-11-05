import { reviewActionBodySchema } from '~~/shared/schemas'
import { getDatabase } from '../../../utils/db'
import { apiError, parseBody } from '../../../utils/http'
import { applyReviewAction } from '../../../utils/review-state'

export default defineEventHandler(async (event) => {
  const type = getRouterParam(event, 'type')
  const id = getRouterParam(event, 'id')

  if (type !== 'memo' && type !== 'entry') {
    throw apiError(400, 'INVALID_REVIEW_SOURCE', '回看来源无效')
  }
  if (!id) {
    throw apiError(404, 'REVIEW_SOURCE_NOT_FOUND', '回看内容不存在或已被删除')
  }

  const { action } = await parseBody(event, reviewActionBodySchema)
  const state = applyReviewAction(getDatabase(), { type, id }, action)

  return { state }
})

import { getDatabase } from '../../../utils/db'
import { apiError } from '../../../utils/http'
import { getReviewItem } from '../../../utils/review'

export default defineEventHandler((event) => {
  const type = getRouterParam(event, 'type')
  const id = getRouterParam(event, 'id')

  if (type !== 'memo' && type !== 'entry') {
    throw apiError(400, 'INVALID_REVIEW_SOURCE', '回看来源无效')
  }
  if (!id) {
    throw apiError(404, 'REVIEW_SOURCE_NOT_FOUND', '回看内容不存在或已被删除')
  }

  const item = getReviewItem(getDatabase(), type, id)
  if (!item) {
    throw apiError(404, 'REVIEW_SOURCE_NOT_FOUND', '回看内容不存在或已被删除')
  }

  return { item }
})

import { getDatabase } from '../../utils/db'
import { apiError } from '../../utils/http'
import { getMemo } from '../../utils/memos'

export default defineEventHandler((event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw apiError(404, 'MEMO_NOT_FOUND', '笔记不存在或已被删除')
  }

  const memo = getMemo(getDatabase(), id)
  if (!memo) {
    throw apiError(404, 'MEMO_NOT_FOUND', '笔记不存在或已被删除')
  }

  return { memo }
})

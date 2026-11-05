import { getDatabase } from '../../utils/db'
import { apiError } from '../../utils/http'
import { deleteMemo } from '../../utils/memos'

export default defineEventHandler((event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw apiError(404, 'MEMO_NOT_FOUND', '笔记不存在或已被删除')
  }

  deleteMemo(getDatabase(), id)
  return { deleted: true }
})

import { updateMemoSchema } from '~~/shared/schemas'
import { getDatabase } from '../../utils/db'
import { apiError, parseBody } from '../../utils/http'
import { updateMemo } from '../../utils/memos'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw apiError(404, 'MEMO_NOT_FOUND', '笔记不存在或已被删除')
  }

  const input = await parseBody(event, updateMemoSchema)
  return { memo: updateMemo(getDatabase(), id, input) }
})

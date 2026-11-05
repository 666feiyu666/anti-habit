import { createMemoSchema } from '~~/shared/schemas'
import { getDatabase } from '../../utils/db'
import { parseBody } from '../../utils/http'
import { createMemo } from '../../utils/memos'

export default defineEventHandler(async (event) => {
  const input = await parseBody(event, createMemoSchema)
  const memo = createMemo(getDatabase(), input)

  setResponseStatus(event, 201)
  return { memo }
})

import { feedQuerySchema } from '~~/shared/schemas'
import { getDatabase } from '../../utils/db'
import { parseQuery } from '../../utils/http'
import { listMemos } from '../../utils/memos'

export default defineEventHandler((event) => {
  const options = parseQuery(event, feedQuerySchema)
  return listMemos(getDatabase(), options)
})

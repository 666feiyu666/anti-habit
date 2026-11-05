import { reviewQuerySchema } from '~~/shared/schemas'
import { getDatabase } from '../../utils/db'
import { parseQuery } from '../../utils/http'
import { listReview } from '../../utils/review'

export default defineEventHandler((event) => {
  const { limit, cursor } = parseQuery(event, reviewQuerySchema)
  return listReview(getDatabase(), { limit, cursor })
})

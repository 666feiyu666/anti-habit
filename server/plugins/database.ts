import { getDatabase } from '../utils/db'

export default defineNitroPlugin(() => {
  getDatabase()
})

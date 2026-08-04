import { clearAuthSession } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  await clearAuthSession(event)
  return { success: true }
})

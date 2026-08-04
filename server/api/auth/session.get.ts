import { getConfiguredPassword, isAuthenticated } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  return {
    authenticated: await isAuthenticated(event),
    configured: Boolean(getConfiguredPassword())
  }
})

import { assertPasswordConfigured, createAuthSession } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  assertPasswordConfigured()

  const body = await readBody<{ password?: string }>(event)
  const password = typeof body?.password === 'string' ? body.password : ''

  if (!password) {
    throw createError({ statusCode: 400, statusMessage: 'Password is required' })
  }

  if (!(await createAuthSession(event, password))) {
    // Small delay to blunt brute-force attempts against a single shared password.
    await new Promise((resolve) => setTimeout(resolve, 500))
    throw createError({ statusCode: 401, statusMessage: 'Incorrect password' })
  }

  return { success: true }
})

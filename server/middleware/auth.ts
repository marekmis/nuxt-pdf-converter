import { getConfiguredPassword, isAuthenticated } from '~/server/utils/auth'

/** Reachable without a session — the login flow itself, plus the assets it needs to render. */
const PUBLIC_ROUTES = ['/login', '/api/auth/login', '/api/auth/logout', '/api/auth/session']

const PUBLIC_PREFIXES = ['/_nuxt/', '/__nuxt', '/_ipx/', '/_fonts/', '/_vercel/']

const PUBLIC_FILES = ['/favicon.ico', '/robots.txt']

function isPublic(path: string): boolean {
  return (
    PUBLIC_ROUTES.includes(path) ||
    PUBLIC_FILES.includes(path) ||
    PUBLIC_PREFIXES.some((prefix) => path.startsWith(prefix))
  )
}

/**
 * Server-side gate for every route. Runs before any page render or API handler, so
 * neither the UI nor the conversion endpoint is reachable without the password.
 */
export default defineEventHandler(async (event) => {
  const path = event.path.split('?')[0]
  const authenticated = await isAuthenticated(event)

  if (authenticated && path === '/login') {
    return sendRedirect(event, '/', 302)
  }

  if (isPublic(path) || authenticated) return

  if (path.startsWith('/api/')) {
    throw createError({
      statusCode: getConfiguredPassword() ? 401 : 503,
      statusMessage: getConfiguredPassword() ? 'Unauthorized' : 'APP_PASSWORD is not configured on the server'
    })
  }

  return sendRedirect(event, `/login?redirect=${encodeURIComponent(event.path)}`, 302)
})

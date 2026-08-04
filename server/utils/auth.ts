import { createHash, timingSafeEqual } from 'node:crypto'
import type { H3Event } from 'h3'

const SESSION_NAME = 'pdf_converter_session'
const SESSION_MAX_AGE = 60 * 60 * 12 // 12 hours

interface AuthSessionData {
  authenticated?: boolean
  loggedInAt?: number
}

/** The single secret this app needs. Empty means "not configured" — we then fail closed. */
export function getConfiguredPassword(): string {
  return useRuntimeConfig().appPassword?.trim() ?? ''
}

/**
 * h3 seals session cookies with a key of at least 32 characters. Deriving it from the
 * password means there is only one env var to manage, and rotating the password
 * invalidates every existing session.
 */
function sessionPassword(password: string): string {
  return createHash('sha256').update(`pdf-converter:${password}`).digest('hex')
}

function sessionConfig(password: string) {
  return {
    name: SESSION_NAME,
    password: sessionPassword(password),
    maxAge: SESSION_MAX_AGE,
    cookie: {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: !import.meta.dev,
      path: '/'
    }
  }
}

/** Constant-time comparison so response timing does not leak the password. */
function passwordMatches(candidate: string, expected: string): boolean {
  const a = createHash('sha256').update(candidate).digest()
  const b = createHash('sha256').update(expected).digest()
  return timingSafeEqual(a, b)
}

export async function isAuthenticated(event: H3Event): Promise<boolean> {
  const password = getConfiguredPassword()
  if (!password) return false

  try {
    const session = await useSession<AuthSessionData>(event, sessionConfig(password))
    return session.data.authenticated === true
  } catch {
    // Tampered or stale cookie (e.g. sealed with a previous password).
    return false
  }
}

export async function createAuthSession(event: H3Event, candidate: string): Promise<boolean> {
  const password = getConfiguredPassword()
  if (!password || !passwordMatches(candidate, password)) return false

  const session = await useSession<AuthSessionData>(event, sessionConfig(password))
  await session.update({ authenticated: true, loggedInAt: Date.now() })
  return true
}

export async function clearAuthSession(event: H3Event): Promise<void> {
  const password = getConfiguredPassword()
  if (!password) return

  try {
    const session = await useSession<AuthSessionData>(event, sessionConfig(password))
    await session.clear()
  } catch {
    // Nothing to clear.
  }
}

export function assertPasswordConfigured(): void {
  if (!getConfiguredPassword()) {
    throw createError({
      statusCode: 503,
      statusMessage: 'APP_PASSWORD is not configured on the server'
    })
  }
}

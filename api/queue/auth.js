import { clearSessionCookie, createSessionToken, passwordMatches, requireArtist, setSessionCookie } from '../_lib/auth.js'
import { json, methodNotAllowed, rateLimit, readJson, clientIp, wrap } from '../_lib/http.js'

export default wrap(async (req, res) => {
  if (req.method === 'GET') {
    const session = requireArtist(req, res)
    if (!session) return
    return json(res, 200, { ok: true, authenticated: true })
  }

  if (req.method === 'DELETE') {
    clearSessionCookie(res, req)
    return json(res, 200, { ok: true })
  }

  if (req.method !== 'POST') return methodNotAllowed(res, 'GET, POST, DELETE')
  if (!rateLimit(`auth:${clientIp(req)}`, { limit: 8, windowMs: 15 * 60 * 1000 })) {
    return json(res, 429, { ok: false, error: 'rate_limited', message: 'Too many login attempts. Please wait.' })
  }
  const body = await readJson(req)
  if (!passwordMatches(body.password)) {
    return json(res, 401, { ok: false, error: 'invalid_password', message: 'That passcode doesn’t match.' })
  }
  setSessionCookie(res, createSessionToken(), req)
  return json(res, 200, { ok: true, authenticated: true })
})

import { createHmac, timingSafeEqual } from 'node:crypto'
import { json } from './http.js'

const COOKIE = 'eh_queue_admin'
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7

function secret() {
  return process.env.SESSION_SECRET || process.env.QUEUE_ADMIN_PASSWORD || ''
}

function sign(payload) {
  return createHmac('sha256', secret()).update(payload).digest('base64url')
}

export function createSessionToken() {
  const payload = Buffer.from(JSON.stringify({ role: 'artist', exp: Date.now() + MAX_AGE_SECONDS * 1000 })).toString('base64url')
  return `${payload}.${sign(payload)}`
}

export function verifySessionToken(token) {
  if (!token || !secret()) return null
  const split = token.lastIndexOf('.')
  if (split < 0) return null
  const payload = token.slice(0, split)
  const digest = token.slice(split + 1)
  const expected = sign(payload)
  const a = Buffer.from(digest)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    if (data.role !== 'artist' || data.exp < Date.now()) return null
    return data
  } catch {
    return null
  }
}

export function passwordMatches(input) {
  const expected = process.env.QUEUE_ADMIN_PASSWORD || ''
  if (!expected || !input) return false
  const a = createHmac('sha256', secret()).update(String(input)).digest()
  const b = createHmac('sha256', secret()).update(expected).digest()
  return a.length === b.length && timingSafeEqual(a, b)
}

export function parseCookies(req) {
  const header = req.headers.cookie || ''
  const out = {}
  for (const part of header.split(';')) {
    const idx = part.indexOf('=')
    if (idx < 0) continue
    out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim())
  }
  return out
}

function cookieSecure(res, req) {
  const host = String(req?.headers?.host || '')
  return !host.includes('localhost') && !host.includes('127.0.0.1')
}

export function setSessionCookie(res, token, req) {
  const secure = cookieSecure(res, req)
  res.setHeader('Set-Cookie', `${COOKIE}=${encodeURIComponent(token)}; HttpOnly; Path=/; Max-Age=${MAX_AGE_SECONDS}; SameSite=Lax${secure ? '; Secure' : ''}`)
}

export function clearSessionCookie(res, req) {
  const secure = cookieSecure(res, req)
  res.setHeader('Set-Cookie', `${COOKIE}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax${secure ? '; Secure' : ''}`)
}

export function requireArtist(req, res) {
  if (!process.env.QUEUE_ADMIN_PASSWORD) {
    json(res, 503, { ok: false, error: 'unconfigured', message: 'Queue admin password is not configured.' })
    return null
  }
  const token = parseCookies(req)[COOKIE]
  const session = verifySessionToken(token)
  if (!session) {
    json(res, 401, { ok: false, error: 'unauthorized' })
    return null
  }
  return session
}

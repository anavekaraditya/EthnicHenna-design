export function json(res, status, body) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(body))
}

export function methodNotAllowed(res, allow) {
  res.setHeader('Allow', allow)
  json(res, 405, { ok: false, error: 'method_not_allowed' })
}

export async function readJson(req, limit = 8000) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > limit) {
      const error = new Error('payload_too_large')
      error.code = 'payload_too_large'
      throw error
    }
    chunks.push(chunk)
  }
  if (!chunks.length) return {}
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
  } catch {
    const error = new Error('invalid_json')
    error.code = 'invalid_json'
    throw error
  }
}

export function clientIp(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()
  return forwarded || req.socket?.remoteAddress || 'unknown'
}

const buckets = new Map()

export function rateLimit(key, { limit = 8, windowMs = 10 * 60 * 1000 } = {}) {
  const now = Date.now()
  const bucket = buckets.get(key)?.filter((stamp) => now - stamp < windowMs) || []
  if (bucket.length >= limit) return false
  bucket.push(now)
  buckets.set(key, bucket)
  return true
}

export function siteUrl(req) {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/$/, '')
  const proto = req.headers['x-forwarded-proto'] || 'https'
  const host = req.headers['x-forwarded-host'] || req.headers.host
  if (host) return `${proto}://${host}`
  return 'https://ethnic-henna-design.vercel.app'
}

export function wrap(handler) {
  return async (req, res) => {
    try {
      await handler(req, res)
    } catch (error) {
      if (error.code === 'payload_too_large') return json(res, 413, { ok: false, error: 'payload_too_large' })
      if (error.code === 'invalid_json') return json(res, 400, { ok: false, error: 'invalid_json' })
      console.error('[queue-api]', error)
      return json(res, 500, { ok: false, error: 'server_error', message: 'Something went wrong. Please try again.' })
    }
  }
}

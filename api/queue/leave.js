import { getQueueBackend } from '../_lib/backend.js'
import { json, methodNotAllowed, rateLimit, readJson, siteUrl, clientIp, wrap } from '../_lib/http.js'

export default wrap(async (req, res) => {
  if (req.method !== 'POST') return methodNotAllowed(res, 'POST')
  if (!rateLimit(`leave:${clientIp(req)}`, { limit: 20, windowMs: 10 * 60 * 1000 })) {
    return json(res, 429, { ok: false, error: 'rate_limited', message: 'Please wait a moment.' })
  }
  const body = await readJson(req)
  if (!body.token) return json(res, 400, { ok: false, error: 'missing_token' })
  try {
    const result = await getQueueBackend().leaveQueue(body.token, siteUrl(req))
    return json(res, result.ok ? 200 : 404, result)
  } catch (error) {
    if (error.code === 'unconfigured') return json(res, 503, { ok: false, error: 'unconfigured', message: "The henna queue isn't open right now." })
    throw error
  }
})

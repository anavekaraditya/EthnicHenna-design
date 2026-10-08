import { getQueueBackend } from '../_lib/backend.js'
import { clientIp, json, methodNotAllowed, rateLimit, readJson, siteUrl, wrap } from '../_lib/http.js'

export default wrap(async (req, res) => {
  if (req.method !== 'POST') return methodNotAllowed(res, 'POST')
  if (!rateLimit(`recover:${clientIp(req)}`, { limit: 6, windowMs: 10 * 60 * 1000 })) {
    return json(res, 429, { ok: false, error: 'rate_limited', message: 'Please wait a moment before trying again.' })
  }
  const body = await readJson(req)
  try {
    const result = await getQueueBackend().recoverGuest(body.phone, siteUrl(req))
    return json(res, result.ok ? 200 : 404, result)
  } catch (error) {
    if (error.code === 'unconfigured') return json(res, 503, { ok: false, error: 'unconfigured', message: "The henna queue isn't open right now." })
    throw error
  }
})

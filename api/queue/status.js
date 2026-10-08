import { getQueueBackend } from '../_lib/backend.js'
import { json, methodNotAllowed, siteUrl, wrap } from '../_lib/http.js'

export default wrap(async (req, res) => {
  if (req.method !== 'GET') return methodNotAllowed(res, 'GET')
  const url = new URL(req.url, 'http://localhost')
  const token = url.searchParams.get('t') || url.searchParams.get('token')
  if (!token) return json(res, 400, { ok: false, error: 'missing_token', message: 'Missing queue ticket.' })
  try {
    const result = await getQueueBackend().getGuestStatus(token, siteUrl(req))
    return json(res, result.ok ? 200 : 404, result)
  } catch (error) {
    if (error.code === 'unconfigured') return json(res, 503, { ok: false, error: 'unconfigured', message: "The henna queue isn't open right now." })
    throw error
  }
})

import { requireArtist } from '../_lib/auth.js'
import { getQueueBackend } from '../_lib/backend.js'
import { json, methodNotAllowed, readJson, siteUrl, wrap } from '../_lib/http.js'

export default wrap(async (req, res) => {
  const session = requireArtist(req, res)
  if (!session) return

  if (req.method === 'GET') {
    try {
      const result = await getQueueBackend().getAdminState()
      return json(res, 200, result)
    } catch (error) {
      if (error.code === 'unconfigured') return json(res, 503, { ok: false, error: 'unconfigured', message: 'Firebase is not configured yet.' })
      throw error
    }
  }

  if (req.method !== 'POST') return methodNotAllowed(res, 'GET, POST')
  const body = await readJson(req)
  if (!body.action) return json(res, 400, { ok: false, error: 'missing_action' })
  try {
    const result = await getQueueBackend().runAdminAction(body.action, body, siteUrl(req))
    return json(res, result.ok ? 200 : 409, result)
  } catch (error) {
    if (error.code === 'unconfigured') return json(res, 503, { ok: false, error: 'unconfigured', message: 'Firebase is not configured yet.' })
    throw error
  }
})

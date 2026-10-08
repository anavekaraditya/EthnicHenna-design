import { getQueueBackend } from '../_lib/backend.js'
import { getWebPushPublicKey, validatePushSubscription, webPushConfigured } from '../_lib/webPush.js'
import { json, methodNotAllowed, readJson, wrap } from '../_lib/http.js'

export default wrap(async (req, res) => {
  if (req.method === 'GET') {
    return json(res, 200, { ok: true, configured: webPushConfigured(), publicKey: webPushConfigured() ? getWebPushPublicKey() : null })
  }
  let backend
  try {
    backend = getQueueBackend()
  } catch (error) {
    if (error.code === 'unconfigured') return json(res, 503, { ok: false, error: 'unconfigured', message: 'Queue storage is not configured yet.' })
    throw error
  }
  if (req.method === 'POST') {
    const body = await readJson(req, 12000)
    if (!body.token || !validatePushSubscription(body.subscription)) {
      return json(res, 400, { ok: false, error: 'invalid_subscription', message: 'Could not enable browser notifications for this ticket.' })
    }
    if (!webPushConfigured()) {
      return json(res, 503, { ok: false, error: 'push_unconfigured', message: 'Browser notifications are not configured yet.' })
    }
    const result = await backend.savePushSubscription(body.token, body.subscription)
    return json(res, result.ok ? 200 : 404, result)
  }
  if (req.method === 'DELETE') {
    const body = await readJson(req, 12000)
    if (!body.token) return json(res, 400, { ok: false, error: 'missing_token' })
    const result = await backend.removePushSubscription(body.token)
    return json(res, result.ok ? 200 : 404, result)
  }
  return methodNotAllowed(res, 'GET, POST, DELETE')
})

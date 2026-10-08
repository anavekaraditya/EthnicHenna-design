import { getQueueBackend } from '../_lib/backend.js'
import { json, methodNotAllowed, wrap } from '../_lib/http.js'

export default wrap(async (req, res) => {
  if (req.method !== 'GET') return methodNotAllowed(res, 'GET')
  try {
    const summary = await getQueueBackend().getPublicSummary()
    return json(res, 200, summary)
  } catch (error) {
    if (error.code === 'unconfigured') return json(res, 503, { ok: false, error: 'unconfigured', open: false, paused: false, waitingCount: 0, message: "The henna queue isn't open right now." })
    throw error
  }
})

import { json, methodNotAllowed, wrap } from '../_lib/http.js'
import { isFirebaseConfigured, firebaseDb } from '../_lib/firebase.js'
import { verifyTelnyxSignature } from '../_lib/telnyxWebhook.js'
import { processTelnyxWebhook } from '../_lib/queueStore.js'
import { processTelnyxWebhook as processLocalTelnyxWebhook } from '../_lib/localQueue.js'

export const config = { api: { bodyParser: false } }

const MAX_BODY_BYTES = 64 * 1024

async function readRawBody(req) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > MAX_BODY_BYTES) {
      const error = new Error('payload_too_large')
      error.code = 'payload_too_large'
      throw error
    }
    chunks.push(buffer)
  }
  return Buffer.concat(chunks)
}

async function telnyxWebhook(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, 'POST')

  let rawBody
  try {
    rawBody = await readRawBody(req)
  } catch (error) {
    if (error.code === 'payload_too_large') return json(res, 413, { ok: false, error: 'payload_too_large' })
    throw error
  }

  const signature = req.headers['telnyx-signature-ed25519']
  const timestamp = req.headers['telnyx-timestamp']
  if (!process.env.TELNYX_PUBLIC_KEY) {
    console.error('[telnyx-webhook] TELNYX_PUBLIC_KEY is not configured')
    return json(res, 503, { ok: false, error: 'webhook_not_configured' })
  }
  if (!verifyTelnyxSignature({
    rawBody,
    signature,
    timestamp,
    publicKey: process.env.TELNYX_PUBLIC_KEY,
  })) return json(res, 401, { ok: false, error: 'invalid_signature' })

  let event
  try {
    event = JSON.parse(rawBody.toString('utf8'))
  } catch {
    return json(res, 400, { ok: false, error: 'invalid_json' })
  }
  if (!event?.data?.event_type || !event?.data?.payload) {
    return json(res, 400, { ok: false, error: 'invalid_event' })
  }
  if (!isFirebaseConfigured()) {
    const result = await processLocalTelnyxWebhook(event)
    return json(res, 200, { ok: true, ...result })
  }

  const result = await processTelnyxWebhook(event, firebaseDb())
  return json(res, 200, { ok: true, ...result })
}

export default wrap(telnyxWebhook)

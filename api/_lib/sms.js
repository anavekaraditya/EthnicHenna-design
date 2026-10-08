import { maskPhone } from '../../src/queue/engine.js'

export async function sendSms({ to, body, kind }) {
  const enabled = String(process.env.SMS_ENABLED || '').trim().toLowerCase() === 'true'
  if (!enabled) {
    const preview = String(body).replace(/https?:\/\/\S+/g, '[link]')
    console.info('[sms:dev]', { kind, to: maskPhone(to), preview: preview.slice(0, 90) })
    return { ok: true, simulated: true, error: 'SMS sending is disabled' }
  }

  if (!to || !body) return { ok: false, error: 'SMS needs a recipient and message.' }

  const apiKey = process.env.TELNYX_API_KEY
  const from = process.env.TELNYX_PHONE_NUMBER
  const messagingProfileId = process.env.TELNYX_MESSAGING_PROFILE_ID
  if (!apiKey || (!from && !messagingProfileId)) {
    console.error('[sms] Telnyx is enabled but credentials are missing')
    return { ok: false, error: 'Telnyx is not configured' }
  }

  let timeout
  try {
    const payload = { to, text: body }
    if (from) payload.from = from
    if (messagingProfileId) payload.messaging_profile_id = messagingProfileId
    const controller = new AbortController()
    timeout = setTimeout(() => controller.abort(), 10000)
    const response = await fetch('https://api.telnyx.com/v2/messages', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
    clearTimeout(timeout)
    timeout = undefined
    const payloadJson = await response.json().catch(() => ({}))
    const recipient = payloadJson.data?.to?.[0] || {}
    if (!response.ok) {
      const err = payloadJson.errors?.[0]
      console.error('[sms] Telnyx send failed', {
        kind,
        to: maskPhone(to),
        status: response.status,
        errorCode: err?.code || null,
        errorTitle: err?.title || null,
        detail: String(err?.detail || '').slice(0, 240),
      })
      return { ok: false, error: 'SMS could not be sent' }
    }
    console.info('[sms] Telnyx accepted', {
      kind,
      to: maskPhone(to),
      id: payloadJson.data?.id || null,
      toStatus: recipient.status || null,
    })
    return {
      ok: true,
      providerMessageId: payloadJson.data?.id || null,
      providerStatus: recipient.status || 'accepted',
    }
  } catch (error) {
    clearTimeout(timeout)
    console.error('[sms] send failed', { kind, to: maskPhone(to), reason: error.name === 'AbortError' ? 'timeout' : 'network' })
    return { ok: false, error: error.name === 'AbortError' ? 'SMS provider timed out' : 'SMS could not be sent' }
  }
}

import webpush from 'web-push'

const ALLOWED_PUSH_HOSTS = [
  'fcm.googleapis.com',
  'push.services.mozilla.com',
  'web.push.apple.com',
  'notify.windows.com',
]

let configuredSubject

export function getWebPushPublicKey() {
  return String(process.env.VAPID_PUBLIC_KEY || '').trim()
}

export function webPushConfigured() {
  const subject = String(process.env.VAPID_SUBJECT || '').trim()
  return Boolean(
    getWebPushPublicKey()
    && process.env.VAPID_PRIVATE_KEY
    && /^(?:mailto:[^@\s]+@[^@\s]+\.[^@\s]+|https:\/\/\S+)$/.test(subject),
  )
}

export function validatePushSubscription(subscription) {
  try {
    const endpoint = new URL(subscription?.endpoint)
    const hostAllowed = ALLOWED_PUSH_HOSTS.some((host) => endpoint.hostname === host || endpoint.hostname.endsWith(`.${host}`))
    return endpoint.protocol === 'https:'
      && hostAllowed
      && typeof subscription?.keys?.p256dh === 'string'
      && typeof subscription?.keys?.auth === 'string'
      && subscription.keys.p256dh.length <= 256
      && subscription.keys.auth.length <= 128
  } catch {
    return false
  }
}

function configureWebPush() {
  if (!webPushConfigured()) {
    const error = new Error('Browser notifications are not configured yet.')
    error.code = 'push_unconfigured'
    throw error
  }
  const subject = String(process.env.VAPID_SUBJECT || '').trim()
  if (!/^(?:mailto:[^@\s]+@[^@\s]+\.[^@\s]+|https:\/\/\S+)$/.test(subject)) {
    const error = new Error('VAPID_SUBJECT must be a mailto: address or HTTPS URL.')
    error.code = 'push_unconfigured'
    throw error
  }
  if (configuredSubject !== `${subject}:${getWebPushPublicKey()}:${process.env.VAPID_PRIVATE_KEY}`) {
    webpush.setVapidDetails(subject, getWebPushPublicKey(), process.env.VAPID_PRIVATE_KEY)
    configuredSubject = `${subject}:${getWebPushPublicKey()}:${process.env.VAPID_PRIVATE_KEY}`
  }
}

export async function sendWebPush(subscription, notification) {
  if (!webPushConfigured()) return { ok: false, skipped: true, reason: 'not_configured' }
  if (!validatePushSubscription(subscription)) return { ok: false, skipped: true, reason: 'invalid_subscription' }
  try {
    configureWebPush()
    await webpush.sendNotification(subscription, JSON.stringify(notification), { TTL: 1800, timeout: 5000 })
    return { ok: true }
  } catch (error) {
    if (error.statusCode === 404 || error.statusCode === 410) return { ok: false, expired: true }
    console.error('[web-push] delivery failed', { statusCode: error.statusCode || null })
    return { ok: false, error: 'push_delivery_failed' }
  }
}

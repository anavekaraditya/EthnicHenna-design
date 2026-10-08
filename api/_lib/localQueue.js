import { randomBytes, randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createMemoryQueue, normalizePhone } from '../../src/queue/engine.js'
import { sendSms } from './sms.js'
import { sendWebPush } from './webPush.js'

const dataPath = join(dirname(fileURLToPath(import.meta.url)), '../../.queue-data.json')

function persist(queue) {
  mkdirSync(dirname(dataPath), { recursive: true })
  writeFileSync(dataPath, JSON.stringify({
    sessions: queue.sessions,
    entries: queue.entries,
  }))
}

function restore(queue, snapshot) {
  queue.sessions.splice(0, queue.sessions.length, ...(snapshot.sessions || []))
  queue.entries.splice(0, queue.entries.length, ...(snapshot.entries || []))
}

function createQueue() {
  const queue = createMemoryQueue({
    randomId: () => randomUUID(),
    randomToken: () => randomBytes(32).toString('base64url'),
    sendSms: async ({ to, kind, body }) => {
      const result = await sendSms({ to, kind, body })
      if (!result.ok) throw new Error(result.error || 'SMS could not be sent')
      return result
    },
  })
  if (existsSync(dataPath)) {
    try {
      restore(queue, JSON.parse(readFileSync(dataPath, 'utf8')))
    } catch {
      // Start clean if the local file is unreadable.
    }
  }
  return queue
}

let queue
const handledWebhookEvents = new Set()

function getQueue() {
  if (!queue) queue = createQueue()
  return queue
}

function saved(result) {
  persist(getQueue())
  return result
}

async function sendQueuePush(entry, stage) {
  if (!entry?.push_subscription || entry[`notification_${stage}_push_sent_at`]) return false
  const isTurn = stage === 'turn'
  const result = await sendWebPush(entry.push_subscription, {
    title: isTurn ? "It's your turn" : "You're next",
    body: isTurn ? 'Please come to the henna station now.' : 'Please stay nearby. Your turn is coming up.',
    url: `/queue?t=${encodeURIComponent(entry.guest_token)}`,
    tag: `queue-${entry.id}-${stage}`,
  })
  if (result.ok) entry[`notification_${stage}_push_sent_at`] = new Date().toISOString()
  if (result.expired) entry.push_subscription = null
  return result.ok
}

async function syncPushNotifications() {
  const current = getQueue()
  const session = current.sessions.find((item) => item.is_active)
  if (!session) return
  const serving = current.entries.find((entry) => entry.session_id === session.id && entry.status === 'serving')
  const waiting = current.entries.filter((entry) => entry.session_id === session.id && entry.status === 'waiting')
    .sort((a, b) => a.order_index - b.order_index)
  const next = serving ? waiting[0] : null
  for (const entry of current.entries) {
    if (['completed', 'removed'].includes(entry.status)) entry.push_subscription = null
    if (entry.status !== 'serving' && entry.notification_turn_push_sent_at) entry.notification_turn_push_sent_at = null
    if (entry.status === 'waiting' && entry.id !== next?.id && entry.notification_next_push_sent_at) entry.notification_next_push_sent_at = null
  }
  await sendQueuePush(serving, 'turn')
  await sendQueuePush(next, 'next')
  persist(current)
}

export async function getPublicSummary() {
  return { ok: true, ...getQueue().summary() }
}

export async function getGuestStatus(token) {
  const guest = getQueue().guestByToken(token)
  if (!guest) {
    return { ok: false, error: 'invalid_token', message: 'We couldn’t find that ticket. If you still have your ticket link, try opening it again; otherwise, join the queue again.' }
  }
  return { ok: true, guest }
}

export async function recoverGuest(phone) {
  const normalized = normalizePhone(phone)
  if (!normalized) return { ok: false, error: 'invalid_phone', message: 'Please enter a valid phone number.' }
  const current = getQueue()
  const session = current.sessions.find((item) => item.is_active)
  const entry = current.entries.find((item) => (
    session
    && item.session_id === session.id
    && item.phone === normalized
    && ['waiting', 'serving', 'skipped'].includes(item.status)
  ))
  if (!entry) return { ok: false, error: 'not_found', message: 'We couldn’t find an active ticket for that number.' }
  return { ok: true, guest: current.guestByToken(entry.guest_token) }
}

export async function joinQueue({ name, phone, consent }) {
  const result = await getQueue().join({
    name,
    phone,
    consent,
    bypassPause: false,
  })
  saved(result)
  await syncPushNotifications()
  return result
}

export async function leaveQueue(token) {
  const result = await getQueue().leave(token)
  saved(result)
  await syncPushNotifications()
  return result
}

export async function getAdminState() {
  return { ok: true, admin: getQueue().admin() }
}

export async function runAdminAction(action, payload = {}) {
  const current = getQueue()
  let result
  if (action === 'pause') result = current.pause()
  else if (action === 'resume') result = current.resume()
  else if (action === 'reset') result = current.reset()
  else if (action === 'start') result = await current.startServing()
  else if (action === 'complete') result = await current.completeCurrent(payload.servingId)
  else if (action === 'skip') result = await current.skipGuest(payload.id)
  else if (action === 'restore') result = await current.restoreGuest(payload.id, { toFront: Boolean(payload.toFront) })
  else if (action === 'remove') result = await current.removeGuest(payload.id)
  else if (action === 'move') result = await current.moveGuest(payload.id, payload.direction)
  else if (action === 'serveNow') result = await current.serveNow(payload.id)
  else if (action === 'addGuest') result = await current.addWalkIn(payload)
  else if (action === 'retrySms') result = await current.retrySms(payload.id)
  else return { ok: false, error: 'unknown_action', message: 'Unknown action.' }

  if (result?.guest && !result.admin) {
    result = { ...result, admin: current.admin() }
  }
  saved(result)
  await syncPushNotifications()
  return result
}

export async function savePushSubscription(token, subscription) {
  const current = getQueue()
  const session = current.sessions.find((item) => item.is_active)
  const entry = current.entries.find((item) => item.guest_token === token && item.session_id === session?.id)
  if (!entry || !['waiting', 'serving', 'skipped'].includes(entry.status)) {
    return { ok: false, error: 'invalid_ticket', message: 'That queue ticket is no longer active.' }
  }
  entry.push_subscription = subscription
  entry.notification_next_push_sent_at = null
  entry.notification_turn_push_sent_at = null
  const waiting = current.entries.filter((item) => item.session_id === entry.session_id && item.status === 'waiting')
    .sort((a, b) => a.order_index - b.order_index)
  const serving = current.entries.find((item) => item.session_id === entry.session_id && item.status === 'serving')
  if (entry.status === 'serving') await sendQueuePush(entry, 'turn')
  else if (session?.is_active && serving && waiting[0]?.id === entry.id) await sendQueuePush(entry, 'next')
  persist(current)
  return { ok: true }
}

export async function removePushSubscription(token) {
  const current = getQueue()
  const entry = current.entries.find((item) => item.guest_token === token)
  if (!entry) return { ok: false, error: 'invalid_ticket' }
  entry.push_subscription = null
  persist(current)
  return { ok: true }
}

export async function processTelnyxWebhook(event) {
  const { id: eventId, event_type: eventType, payload } = event.data
  const current = getQueue()
  if (eventId && handledWebhookEvents.has(eventId)) return { handled: true, duplicate: true }

  if (eventType === 'message.received') {
    const phone = normalizePhone(payload?.from?.phone_number || payload?.from || '')
    const keyword = String(payload?.text || '').trim().toUpperCase().split(/\s+/)[0]?.replace(/[.!?]+$/g, '')
    if (['STOP', 'STOPALL', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT'].includes(keyword)) {
      for (const entry of current.entries) {
        if (entry.phone === phone && ['waiting', 'serving', 'skipped'].includes(entry.status)) {
          entry.sms_consent = false
          entry.sms_opted_out_at = new Date().toISOString()
        }
      }
      if (eventId) handledWebhookEvents.add(eventId)
      persist(current)
      return { handled: true, action: 'opt_out' }
    }
    if (keyword === 'HELP' || keyword === 'INFO') {
      const result = phone
        ? await sendSms({ to: phone, kind: 'help', body: 'Ethnic Henna queue: texts are for queue updates. Reply STOP to opt out. For help, contact us through our website.' })
        : { ok: false }
      if (eventId) handledWebhookEvents.add(eventId)
      return { handled: Boolean(result.ok), action: 'help' }
    }
    if (eventId) handledWebhookEvents.add(eventId)
    return { handled: true, action: 'inbound_ignored' }
  }

  if (eventType.startsWith('message.')) {
    const messageId = payload?.id
    const entry = current.entries.find((item) => item.last_sms_provider_id === messageId)
    const recipient = Array.isArray(payload?.to) ? payload.to.find((item) => item?.status) : null
    const status = String(recipient?.status || eventType.replace(/^message\./, '')).toLowerCase()
    if (entry && messageId) {
      entry.last_sms_status = status === 'delivery_failed' || status === 'sending_failed' ? 'failed' : status === 'finalized' ? 'delivered' : status
      entry.last_sms_status_kind = entry.last_sms_kind || null
      entry.updated_at = new Date().toISOString()
      persist(current)
    }
    if (eventId) handledWebhookEvents.add(eventId)
    return { handled: true, action: entry ? 'delivery_updated' : 'message_unmatched' }
  }

  if (eventId) handledWebhookEvents.add(eventId)
  return { handled: true, action: 'event_ignored' }
}

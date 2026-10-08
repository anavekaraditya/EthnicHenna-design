import { createHash, randomBytes } from 'node:crypto'
import {
  buildAdminView,
  buildGuestView,
  initialsFromName,
  normalizePhone,
  publicSummary,
  servingEntry,
  sanitizeName,
  waitingEntries,
} from '../../src/queue/engine.js'
import { joinSms, nextSms, statusUrlForToken, turnSms } from '../../src/queue/smsCopy.js'
import { firebaseDb } from './firebase.js'
import { sendSms } from './sms.js'
import { sendWebPush } from './webPush.js'

const ACTIVE_PHONE = new Set(['waiting', 'serving', 'skipped'])

function token() {
  return randomBytes(32).toString('base64url')
}

function phoneClaimId(sessionId, phone) {
  return createHash('sha256').update(`${sessionId}:${phone}`).digest('hex')
}

function nowIso() {
  return new Date().toISOString()
}

function dataWithId(doc) {
  return { id: doc.id, ...doc.data() }
}

async function loadSession(db) {
  const metaRef = db.collection('queue_meta').doc('current')
  return db.runTransaction(async (tx) => {
    const meta = await tx.get(metaRef)
    if (meta.exists && meta.data().session_id) {
      const current = await tx.get(db.collection('queue_sessions').doc(meta.data().session_id))
      if (current.exists && current.data().is_active) return dataWithId(current)
    }
    const sessionRef = db.collection('queue_sessions').doc()
    const session = {
      is_active: true,
      is_paused: false,
      average_service_minutes: 10,
      event_name: null,
      created_at: nowIso(),
      updated_at: nowIso(),
    }
    tx.set(sessionRef, session)
    tx.set(metaRef, { session_id: sessionRef.id, updated_at: nowIso() })
    return { id: sessionRef.id, ...session }
  })
}

async function loadEntries(db, sessionId) {
  const snap = await db.collection('queue_entries').where('session_id', '==', sessionId).get()
  return snap.docs.map(dataWithId).sort((a, b) => a.order_index - b.order_index)
}

async function snapshot(db) {
  const session = await loadSession(db)
  const entries = await loadEntries(db, session.id)
  return {
    session,
    entries,
    admin: buildAdminView(session, entries),
    summary: publicSummary(session, entries),
  }
}

async function updateEntry(db, id, fields) {
  await db.collection('queue_entries').doc(id).update({ ...fields, updated_at: nowIso() })
}

async function notify(entry, kind, body, db) {
  const stamp = nowIso()
  const fields = { last_sms_error: null }
  const fieldByKind = {
    join: ['join_sms_sent_at', 'join_sms_provider_id', 'join_sms_status'],
    next: ['notification_next_sent_at', 'notification_next_provider_id', 'notification_next_status'],
    turn: ['notification_turn_sent_at', 'notification_turn_provider_id', 'notification_turn_status'],
  }
  const [sentField, providerIdField, statusField] = fieldByKind[kind]
  fields[sentField] = stamp
  if (!entry.sms_consent) {
    return { ok: true, skipped: true }
  }
  const result = await sendSms({ to: entry.phone, kind, body })
  if (result.ok && !result.simulated) {
    await updateEntry(db, entry.id, {
      ...fields,
      [providerIdField]: result.providerMessageId || null,
      [statusField]: result.providerStatus || 'accepted',
      last_sms_kind: null,
      last_sms_provider_id: result.providerMessageId || null,
    })
  } else {
    await updateEntry(db, entry.id, {
      last_sms_error: result.simulated ? 'SMS sending is disabled. This text was only previewed.' : (result.error || 'SMS could not be sent'),
      last_sms_kind: kind,
    })
  }
  return result
}

const SMS_PROVIDER_FIELDS = {
  join: ['join_sms_provider_id', 'join_sms_status'],
  next: ['notification_next_provider_id', 'notification_next_status'],
  turn: ['notification_turn_provider_id', 'notification_turn_status'],
}

function smsKindForMessage(payload) {
  const id = payload?.id
  if (!id) return null
  for (const [kind, [idField]] of Object.entries(SMS_PROVIDER_FIELDS)) {
    if (payload[idField] === id) return kind
  }
  return null
}

function messageStatus(eventType, payload) {
  const recipients = Array.isArray(payload?.to) ? payload.to : []
  const providerStatus = recipients.find((recipient) => recipient?.status)?.status
  const candidate = String(providerStatus || eventType.replace(/^message\./, '')).toLowerCase()
  const aliases = {
    finalized: 'delivered',
    delivery_failed: 'failed',
    sending_failed: 'failed',
    sent: 'sent',
    queued: 'queued',
    delivered: 'delivered',
    failed: 'failed',
  }
  return aliases[candidate] || candidate.slice(0, 40)
}

async function updateMessageStatus(db, eventType, payload) {
  const messageId = payload?.id
  if (!messageId) return false
  const entries = db.collection('queue_entries')
  for (const [kind, [idField, statusField]] of Object.entries(SMS_PROVIDER_FIELDS)) {
    const found = await entries.where(idField, '==', messageId).limit(1).get()
    if (found.empty) continue
    const entry = dataWithId(found.docs[0])
    const nextStatus = messageStatus(eventType, payload)
    const currentStatus = String(entry[statusField] || '').toLowerCase()
    // A late `sent` callback must not erase a delivery or failure result.
    if (currentStatus === 'delivered' || (currentStatus === 'failed' && nextStatus !== 'delivered')) return true
    await updateEntry(db, entry.id, {
      [statusField]: nextStatus,
      last_sms_status: nextStatus,
      last_sms_status_kind: kind,
    })
    return true
  }
  return false
}

function normalizeInboundText(value) {
  return String(value || '').trim().toUpperCase().replace(/[.!?]+$/g, '')
}

function inboundPhone(payload) {
  return normalizePhone(payload?.from?.phone_number || payload?.from || '')
}

async function optOutPhone(db, phone) {
  if (!phone) return
  const found = await db.collection('queue_entries').where('phone', '==', phone).get()
  let batch = db.batch()
  let changed = 0
  let pending = 0
  const commits = []
  for (const doc of found.docs) {
    if (!ACTIVE_PHONE.has(doc.data().status) || doc.data().sms_consent === false) continue
    batch.update(doc.ref, {
      sms_consent: false,
      sms_opted_out_at: nowIso(),
      last_sms_error: null,
      last_sms_kind: null,
      updated_at: nowIso(),
    })
    changed += 1
    pending += 1
    if (pending === 450) {
      commits.push(batch.commit())
      batch = db.batch()
      pending = 0
    }
  }
  if (pending) commits.push(batch.commit())
  if (commits.length) await Promise.all(commits)
  return changed
}

async function sendHelpReply(db, eventId, phone) {
  if (!phone) return { handled: false }
  const eventRef = eventId ? db.collection('queue_webhook_events').doc(eventId) : null
  if (eventRef) {
    const claimed = await db.runTransaction(async (tx) => {
      const current = await tx.get(eventRef)
      const now = Date.now()
      if (current.exists && (current.data().state === 'handled' || (current.data().state === 'processing' && current.data().lease_until > now))) return false
      tx.set(eventRef, { state: 'processing', lease_until: now + 2 * 60 * 1000, updated_at: nowIso() })
      return true
    })
    if (!claimed) return { handled: false, duplicate: true }
  }
  const helpText = 'Ethnic Henna queue: texts are for queue updates. Reply STOP to opt out. For help, contact us through our website.'
  const sent = await sendSms({ to: phone, body: helpText, kind: 'help' })
  if (eventRef) {
    await eventRef.set({ state: sent.ok ? 'handled' : 'failed', lease_until: null, updated_at: nowIso() }, { merge: true })
  }
  return { handled: sent.ok, simulated: Boolean(sent.simulated) }
}

export async function processTelnyxWebhook(event, db) {
  const { id: eventId, event_type: eventType, payload } = event.data
  if (eventType === 'message.received') {
    const phone = inboundPhone(payload)
    const keyword = normalizeInboundText(payload?.text).split(/\s+/)[0]
    if (['STOP', 'STOPALL', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT'].includes(keyword)) {
      await optOutPhone(db, phone)
      return { handled: true, action: 'opt_out' }
    }
    if (keyword === 'HELP' || keyword === 'INFO') {
      const result = await sendHelpReply(db, eventId, phone)
      return { handled: result.handled, action: 'help', duplicate: Boolean(result.duplicate) }
    }
    return { handled: true, action: 'inbound_ignored' }
  }

  if (eventType.startsWith('message.')) {
    const updated = await updateMessageStatus(db, eventType, payload)
    return { handled: true, action: updated ? 'delivery_updated' : 'message_unmatched' }
  }
  return { handled: true, action: 'event_ignored' }
}

async function syncNotifications(db, siteUrl) {
  const { session, entries } = await snapshot(db)
  const serving = entries.find((entry) => entry.status === 'serving')
  const waiting = entries.filter((entry) => entry.status === 'waiting').sort((a, b) => a.order_index - b.order_index)
  const nextGuest = serving ? waiting[0] : null
  for (const entry of entries) {
    if (['completed', 'removed'].includes(entry.status) && entry.push_subscription) {
      await updateEntry(db, entry.id, { push_subscription: null })
    }
    if (entry.status !== 'serving' && entry.notification_turn_push_sent_at) {
      await updateEntry(db, entry.id, { notification_turn_push_sent_at: null })
    }
    if (entry.status === 'waiting' && entry.id !== nextGuest?.id && entry.notification_next_push_sent_at) {
      await updateEntry(db, entry.id, { notification_next_push_sent_at: null })
    }
  }
  if (serving && !serving.notification_turn_sent_at) await notify(serving, 'turn', turnSms(), db)
  if (nextGuest && !nextGuest.notification_next_sent_at && !nextGuest.notification_turn_sent_at) {
    await notify(nextGuest, 'next', nextSms(), db)
  }
  if (serving && !serving.notification_turn_push_sent_at) {
    await sendGuestPush(db, serving, 'turn')
  }
  if (nextGuest && !nextGuest.notification_next_push_sent_at) {
    await sendGuestPush(db, nextGuest, 'next')
  }
  return snapshot(db)
}

async function sendGuestPush(db, entry, stage) {
  if (!entry.push_subscription) return false
  const isTurn = stage === 'turn'
  const notification = isTurn
    ? { title: "It's your turn", body: 'Please come to the henna station now.', url: `/queue?t=${encodeURIComponent(entry.guest_token)}`, tag: `queue-${entry.id}-turn` }
    : { title: "You're next", body: 'Please stay nearby. Your turn is coming up.', url: `/queue?t=${encodeURIComponent(entry.guest_token)}`, tag: `queue-${entry.id}-next` }
  const result = await sendWebPush(entry.push_subscription, notification)
  if (result.ok) {
    await updateEntry(db, entry.id, { [`notification_${stage}_push_sent_at`]: nowIso() })
    return true
  }
  if (result.expired) await updateEntry(db, entry.id, { push_subscription: null })
  return false
}

async function findByToken(db, guestToken) {
  const snap = await db.collection('queue_entries').where('guest_token', '==', guestToken).limit(1).get()
  return snap.empty ? null : dataWithId(snap.docs[0])
}

export async function getPublicSummary() {
  const { summary } = await snapshot(firebaseDb())
  return { ok: true, ...summary }
}

export async function getGuestStatus(guestToken, siteUrl) {
  const db = firebaseDb()
  const entry = await findByToken(db, guestToken)
  if (!entry || entry.status === 'removed') {
    return { ok: false, error: 'invalid_token', message: 'We couldn’t find that ticket. If you still have your ticket link, try opening it again; otherwise, join the queue again.' }
  }
  const session = await loadSession(db)
  if (entry.session_id !== session.id) {
    return { ok: false, error: 'expired', message: 'That queue ticket is from a previous event. Join again if you’d like a new place in line.' }
  }
  const entries = await loadEntries(db, session.id)
  return { ok: true, guest: buildGuestView(entry, session, entries, { siteUrl }) }
}

export async function savePushSubscription(guestToken, subscription) {
  const db = firebaseDb()
  const entry = await findByToken(db, guestToken)
  const session = await loadSession(db)
  if (!entry || entry.session_id !== session.id || !ACTIVE_PHONE.has(entry.status)) {
    return { ok: false, error: 'invalid_ticket', message: 'That queue ticket is no longer active.' }
  }
  await updateEntry(db, entry.id, {
    push_subscription: subscription,
    notification_next_push_sent_at: null,
    notification_turn_push_sent_at: null,
  })
  const refreshed = await findByToken(db, guestToken)
  if (refreshed.status === 'serving') await sendGuestPush(db, refreshed, 'turn')
  else {
    const entries = await loadEntries(db, session.id)
    const waiting = entries.filter((item) => item.status === 'waiting').sort((a, b) => a.order_index - b.order_index)
    const serving = entries.find((item) => item.status === 'serving')
    if (serving && waiting[0]?.id === refreshed.id) await sendGuestPush(db, refreshed, 'next')
  }
  return { ok: true }
}

export async function removePushSubscription(guestToken) {
  const db = firebaseDb()
  const entry = await findByToken(db, guestToken)
  if (!entry) return { ok: false, error: 'invalid_ticket' }
  await updateEntry(db, entry.id, { push_subscription: null })
  return { ok: true }
}

export async function recoverGuest(phone, siteUrl) {
  const normalized = normalizePhone(phone)
  if (!normalized) return { ok: false, error: 'invalid_phone', message: 'Please enter a valid phone number.' }
  const db = firebaseDb()
  const session = await loadSession(db)
  const entries = await loadEntries(db, session.id)
  const entry = entries.find((item) => item.phone === normalized && ACTIVE_PHONE.has(item.status))
  if (!entry) return { ok: false, error: 'not_found', message: 'We couldn’t find an active ticket for that number.' }
  return { ok: true, guest: buildGuestView(entry, session, entries, { siteUrl }) }
}

export async function joinQueue({ name, phone, consent, siteUrl, bypassPause = false }) {
  const db = firebaseDb()
  const session = await loadSession(db)
  if (!session.is_active) return { ok: false, error: 'closed', message: "The henna queue isn't open right now." }
  if (session.is_paused && !bypassPause) {
    return {
      ok: false,
      error: 'paused',
      message: "Queue temporarily paused. We're catching up with everyone already waiting. Please check again shortly.",
    }
  }
  const cleanName = sanitizeName(name)
  const rawPhone = String(phone || '').trim()
  const normalized = normalizePhone(phone)
  if (!cleanName) return { ok: false, error: 'invalid_name', message: 'Please enter your name.' }
  if (rawPhone && !normalized) return { ok: false, error: 'invalid_phone', message: 'Please enter a valid phone number.' }
  const result = await db.runTransaction(async (tx) => {
    const metaRef = db.collection('queue_meta').doc('current')
    const sessionRef = db.collection('queue_sessions').doc(session.id)
    const meta = await tx.get(metaRef)
    const currentSession = await tx.get(sessionRef)
    const claimRef = normalized ? db.collection('queue_phone_claims').doc(phoneClaimId(session.id, normalized)) : null
    const claim = claimRef ? await tx.get(claimRef) : null
    const snap = await tx.get(db.collection('queue_entries').where('session_id', '==', session.id))
    if (!meta.exists || meta.data().session_id !== session.id || !currentSession.exists || !currentSession.data().is_active) {
      return { error: 'closed' }
    }
    if (!bypassPause && currentSession.data().is_paused) return { error: 'paused' }
    const entries = snap.docs.map(dataWithId)
    const existing = normalized ? entries.find((item) => item.phone === normalized && ACTIVE_PHONE.has(item.status)) : null
    if (existing) {
      if (claimRef && (!claim.exists || claim.data().entry_id !== existing.id)) tx.set(claimRef, { entry_id: existing.id, updated_at: nowIso() })
      return { alreadyQueued: true, entry: existing, entries }
    }
    const displayNumber = Math.max(
      currentSession.data().last_display_number || 0,
      entries.reduce((max, entry) => Math.max(max, entry.display_number || 0), 0),
    ) + 1
    const active = entries.filter((entry) => entry.status === 'waiting' || entry.status === 'serving')
    const orderIndex = active.length ? Math.max(...active.map((entry) => entry.order_index)) + 1000 : 1000
    const ref = db.collection('queue_entries').doc()
    const entry = {
      session_id: session.id,
      display_number: displayNumber,
      name: cleanName,
      initials: initialsFromName(cleanName),
      phone: normalized,
      status: 'waiting',
      order_index: orderIndex,
      joined_at: nowIso(),
      called_at: null,
      started_at: null,
      completed_at: null,
      skipped_at: null,
      removed_at: null,
      guest_token: token(),
      notification_next_sent_at: null,
      notification_turn_sent_at: null,
      join_sms_sent_at: null,
      join_sms_provider_id: null,
      join_sms_status: null,
      notification_next_provider_id: null,
      notification_next_status: null,
      notification_turn_provider_id: null,
      notification_turn_status: null,
      last_sms_error: null,
      sms_consent: Boolean(consent && normalized),
      created_at: nowIso(),
      updated_at: nowIso(),
    }
    tx.set(ref, entry)
    if (claimRef) tx.set(claimRef, { entry_id: ref.id, updated_at: nowIso() })
    tx.update(sessionRef, { last_display_number: displayNumber, updated_at: nowIso() })
    const created = { id: ref.id, ...entry }
    return { alreadyQueued: false, entry: created, entries: entries.concat(created) }
  })

  if (result.error === 'closed') return { ok: false, error: 'closed', message: "The henna queue isn't open right now." }
  if (result.error === 'paused') {
    return {
      ok: false,
      error: 'paused',
      message: "Queue temporarily paused. We're catching up with everyone already waiting. Please check again shortly.",
    }
  }

  if (result.alreadyQueued) {
    return { ok: true, alreadyQueued: true, guest: buildGuestView(result.entry, session, result.entries, { siteUrl }) }
  }

  if (consent && normalized) {
    const guest = buildGuestView(result.entry, session, result.entries, { siteUrl })
    await notify(result.entry, 'join', joinSms({
      queueNumber: guest.queueNumber,
      waitLabel: guest.waitLabel,
      statusUrl: statusUrlForToken(siteUrl, result.entry.guest_token),
    }), db)
  }
  const after = await syncNotifications(db, siteUrl)
  const fresh = after.entries.find((entry) => entry.id === result.entry.id)
  return { ok: true, alreadyQueued: false, guest: buildGuestView(fresh, after.session, after.entries, { siteUrl }) }
}

export async function leaveQueue(guestToken, siteUrl) {
  const db = firebaseDb()
  const entry = await findByToken(db, guestToken)
  const session = await loadSession(db)
  if (!entry || entry.session_id !== session.id) return { ok: false, error: 'not_found', message: 'We couldn’t find your place in line.' }
  await db.runTransaction(async (tx) => {
    const ref = db.collection('queue_entries').doc(entry.id)
    const current = await tx.get(ref)
    if (!current.exists || current.data().session_id !== session.id) return
    if (!['completed', 'removed'].includes(current.data().status)) {
      const snap = await tx.get(db.collection('queue_entries').where('session_id', '==', session.id))
      const entries = snap.docs.map((doc) => ({ ref: doc.ref, ...dataWithId(doc) }))
      const wasServing = current.data().status === 'serving'
      tx.update(ref, { status: 'removed', removed_at: nowIso(), updated_at: nowIso() })
      if (wasServing) {
        const next = entries.filter((item) => item.id !== entry.id && item.status === 'waiting')
          .sort((a, b) => a.order_index - b.order_index)[0]
        if (next) tx.update(next.ref, {
          status: 'serving', called_at: next.called_at || nowIso(), started_at: nowIso(),
          notification_turn_sent_at: null, updated_at: nowIso(),
        })
      }
    }
  })
  const after = await syncNotifications(db, siteUrl)
  const fresh = after.entries.find((item) => item.id === entry.id) || { ...entry, status: 'removed' }
  return { ok: true, guest: buildGuestView(fresh, after.session, after.entries, { siteUrl }) }
}

export async function getAdminState() {
  const { admin } = await snapshot(firebaseDb())
  return { ok: true, admin }
}

export async function runAdminAction(action, payload = {}, siteUrl) {
  const db = firebaseDb()
  const session = await loadSession(db)
  const sessionRef = db.collection('queue_sessions').doc(session.id)

  if (action === 'pause') {
    await sessionRef.update({ is_paused: true, updated_at: nowIso() })
  } else if (action === 'resume') {
    await sessionRef.update({ is_paused: false, updated_at: nowIso() })
  } else if (action === 'reset') {
    await db.runTransaction(async (tx) => {
      const metaRef = db.collection('queue_meta').doc('current')
      const meta = await tx.get(metaRef)
      const current = await tx.get(sessionRef)
      if (!current.exists || !current.data().is_active || !meta.exists || meta.data().session_id !== session.id) return
      tx.update(sessionRef, { is_active: false, is_paused: false, updated_at: nowIso() })
      const nextRef = db.collection('queue_sessions').doc()
      tx.set(nextRef, {
        is_active: true,
        is_paused: false,
        average_service_minutes: 10,
        event_name: null,
        created_at: nowIso(),
        updated_at: nowIso(),
      })
      tx.set(metaRef, { session_id: nextRef.id, updated_at: nowIso() })
    })
  } else if (action === 'start') {
    const started = await db.runTransaction(async (tx) => {
      const snap = await tx.get(db.collection('queue_entries').where('session_id', '==', session.id))
      const entries = snap.docs.map((doc) => ({ ref: doc.ref, ...dataWithId(doc) }))
      if (entries.some((entry) => entry.status === 'serving')) return { ok: true, noop: true }
      const nextGuest = entries
        .filter((entry) => entry.status === 'waiting')
        .sort((a, b) => a.order_index - b.order_index)[0]
      if (!nextGuest) return { ok: false, error: 'empty_queue' }
      tx.update(nextGuest.ref, {
        status: 'serving',
        called_at: nextGuest.called_at || nowIso(),
        started_at: nowIso(),
        notification_turn_sent_at: null,
        updated_at: nowIso(),
      })
      return { ok: true, noop: false }
    })
    if (!started.ok) return { ok: false, error: started.error, message: 'Queue is empty.' }
  } else if (action === 'complete') {
    if (!payload.servingId) return { ok: false, error: 'missing_serving', message: 'No guest is currently being served.' }
    const completed = await db.runTransaction(async (tx) => {
      const servingRef = db.collection('queue_entries').doc(payload.servingId)
      const serving = await tx.get(servingRef)
      const snap = await tx.get(db.collection('queue_entries').where('session_id', '==', session.id))
      const entries = snap.docs.map((doc) => ({ ref: doc.ref, ...dataWithId(doc) }))
      if (!serving.exists || serving.data().session_id !== session.id || serving.data().status !== 'serving') return false
      tx.update(servingRef, { status: 'completed', completed_at: nowIso(), updated_at: nowIso() })
      const nextGuest = entries
        .filter((entry) => entry.id !== payload.servingId && entry.status === 'waiting')
        .sort((a, b) => a.order_index - b.order_index)[0]
      if (nextGuest) {
        tx.update(nextGuest.ref, {
          status: 'serving',
          called_at: nextGuest.called_at || nowIso(),
          started_at: nowIso(),
          notification_turn_sent_at: null,
          updated_at: nowIso(),
        })
      }
      return true
    })
    if (!completed) return { ok: false, error: 'stale_action', message: 'The queue changed. Refresh and try again.' }
  } else if (action === 'skip') {
    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(db.collection('queue_entries').where('session_id', '==', session.id))
      const entries = snap.docs.map((doc) => ({ ref: doc.ref, ...dataWithId(doc) }))
      const current = entries.find((entry) => entry.id === payload.id)
      if (!current) return 'not_found'
      if (!['waiting', 'serving'].includes(current.status)) return 'immutable'
      tx.update(current.ref, { status: 'skipped', skipped_at: nowIso(), updated_at: nowIso() })
      if (current.status === 'serving') {
        const next = entries.filter((entry) => entry.status === 'waiting').sort((a, b) => a.order_index - b.order_index)[0]
        if (next) tx.update(next.ref, {
          status: 'serving', called_at: next.called_at || nowIso(), started_at: nowIso(),
          notification_turn_sent_at: null, updated_at: nowIso(),
        })
      }
      return 'ok'
    })
    if (result !== 'ok') return { ok: false, error: result, message: result === 'not_found' ? 'Guest not found.' : 'This guest cannot be skipped.' }
  } else if (action === 'restore') {
    const restored = await db.runTransaction(async (tx) => {
      const snap = await tx.get(db.collection('queue_entries').where('session_id', '==', session.id))
      const entries = snap.docs.map((doc) => ({ ref: doc.ref, ...dataWithId(doc) }))
      const current = entries.find((item) => item.id === payload.id)
      if (!current || current.status !== 'skipped') return false
      const waiting = entries.filter((item) => item.status === 'waiting').sort((a, b) => a.order_index - b.order_index)
      const serving = entries.find((item) => item.status === 'serving')
      const orderIndex = payload.toFront
        ? (waiting[0] ? waiting[0].order_index - 1 : (serving ? serving.order_index + 1 : 1000))
        : (waiting.concat(serving || []).reduce((max, item) => Math.max(max, item?.order_index || 0), 0) + 1000)
      tx.update(current.ref, { status: 'waiting', order_index: orderIndex, updated_at: nowIso() })
      return true
    })
    if (!restored) return { ok: false, error: 'not_found', message: 'Guest not found.' }
  } else if (action === 'remove') {
    const removed = await db.runTransaction(async (tx) => {
      const snap = await tx.get(db.collection('queue_entries').where('session_id', '==', session.id))
      const entries = snap.docs.map((doc) => ({ ref: doc.ref, ...dataWithId(doc) }))
      const current = entries.find((entry) => entry.id === payload.id)
      if (!current || ['completed', 'removed'].includes(current.status)) return false
      tx.update(current.ref, { status: 'removed', removed_at: nowIso(), updated_at: nowIso() })
      if (current.status === 'serving') {
        const next = entries.filter((entry) => entry.status === 'waiting').sort((a, b) => a.order_index - b.order_index)[0]
        if (next) tx.update(next.ref, {
          status: 'serving', called_at: next.called_at || nowIso(), started_at: nowIso(),
          notification_turn_sent_at: null, updated_at: nowIso(),
        })
      }
      return true
    })
    if (!removed) return { ok: false, error: 'not_found', message: 'Guest not found.' }
  } else if (action === 'move') {
    if (!['up', 'down'].includes(payload.direction)) return { ok: false, error: 'invalid_direction', message: 'Choose move up or move down.' }
    const moved = await db.runTransaction(async (tx) => {
      const snap = await tx.get(db.collection('queue_entries').where('session_id', '==', session.id))
      const waiting = snap.docs.map((doc) => ({ ref: doc.ref, ...dataWithId(doc) }))
        .filter((item) => item.status === 'waiting').sort((a, b) => a.order_index - b.order_index)
      const index = waiting.findIndex((item) => item.id === payload.id)
      if (index < 0) return false
      const swapWith = payload.direction === 'up' ? index - 1 : index + 1
      if (swapWith < 0 || swapWith >= waiting.length) return true
      const current = waiting[index]
      const other = waiting[swapWith]
      tx.update(current.ref, { order_index: other.order_index, updated_at: nowIso() })
      tx.update(other.ref, { order_index: current.order_index, updated_at: nowIso() })
      return true
    })
    if (!moved) return { ok: false, error: 'not_found', message: 'Guest not found.' }
  } else if (action === 'serveNow') {
    const served = await db.runTransaction(async (tx) => {
      const snap = await tx.get(db.collection('queue_entries').where('session_id', '==', session.id))
      const live = snap.docs.map((doc) => ({ ref: doc.ref, ...dataWithId(doc) }))
      const serving = live.find((item) => item.status === 'serving')
      const target = live.find((item) => item.id === payload.id)
      if (!target || !['waiting', 'skipped'].includes(target.status)) return false
      if (serving && serving.id !== target.id) {
        const waiting = live.filter((item) => item.status === 'waiting').sort((a, b) => a.order_index - b.order_index)
        const front = waiting[0]?.order_index ?? serving.order_index
        tx.update(serving.ref, { status: 'waiting', order_index: front - 1, updated_at: nowIso() })
      }
      tx.update(target.ref, {
        status: 'serving',
        called_at: target.called_at || nowIso(),
        started_at: nowIso(),
        notification_turn_sent_at: null,
        updated_at: nowIso(),
      })
      return true
    })
    if (!served) return { ok: false, error: 'stale_action', message: 'The queue changed. Refresh and try again.' }
  } else if (action === 'retrySms') {
    const { entries } = await snapshot(db)
    const entry = entries.find((item) => item.id === payload.id && item.session_id === session.id)
    let kind = entry?.last_sms_kind
    if (!entry || !entry.sms_consent || !entry.last_sms_error || !['join', 'next', 'turn'].includes(kind)) {
      return { ok: false, error: 'not_retryable', message: 'There is no failed text to retry for this guest.' }
    }
    let body
    if (kind === 'join') {
      const guest = buildGuestView(entry, session, entries, { siteUrl })
      body = joinSms({
        queueNumber: guest.queueNumber,
        waitLabel: guest.waitLabel,
        statusUrl: statusUrlForToken(siteUrl, entry.guest_token),
      })
    } else if (kind === 'turn' || (kind === 'next' && entry.status === 'serving')) {
      kind = 'turn'
      if (entry.status !== 'serving') return { ok: false, error: 'stale_action', message: 'That guest is no longer being served.' }
      body = turnSms()
    } else {
      const waiting = waitingEntries(entries, session.id)
      if (entry.status !== 'waiting' || servingEntry(entries, session.id) == null || waiting[0]?.id !== entry.id) {
        return { ok: false, error: 'stale_action', message: 'That guest is no longer next in line.' }
      }
      body = nextSms()
    }
    const sent = await notify(entry, kind, body, db)
    if (!sent.ok || sent.simulated) {
      const { admin } = await snapshot(db)
      return { ok: false, error: 'sms_failed', message: sent.error || 'SMS sending is disabled. This text was only previewed.', admin }
    }
    const after = await snapshot(db)
    return { ok: true, admin: after.admin }
  } else if (action === 'addGuest') {
    const result = await joinQueue({
      name: payload.name,
      phone: payload.phone,
      consent: Boolean(payload.consent),
      siteUrl,
      bypassPause: true,
    })
    const { admin } = await snapshot(db)
    return { ...result, admin }
  } else {
    return { ok: false, error: 'unknown_action', message: 'Unknown action.' }
  }

  const after = await syncNotifications(db, siteUrl)
  return { ok: true, admin: after.admin }
}

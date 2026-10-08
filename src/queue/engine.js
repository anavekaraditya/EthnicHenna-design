import { joinSms, nextSms, statusUrlForToken, turnSms } from './smsCopy.js'

export const GUEST_TOKEN_STORAGE_KEY = 'ethnic-henna-queue-token'
export const DEFAULT_SERVICE_MINUTES = 10
const ACTIVE_PHONE_STATUSES = new Set(['waiting', 'serving', 'skipped'])

export function initialsFromName(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

function partiallyMaskName(name) {
  return String(name || '').trim().split(/\s+/).filter(Boolean).map((part) => {
    const characters = Array.from(part)
    return `${characters[0]}${'•'.repeat(Math.min(8, Math.max(2, characters.length - 1)))}`
  }).join(' ')
}

export function sanitizeName(name) {
  return String(name || '').replace(/\s+/g, ' ').trim().slice(0, 80)
}

export function normalizePhone(raw) {
  const trimmed = String(raw || '').trim()
  if (!trimmed) return null
  if (trimmed.startsWith('+')) {
    const rest = trimmed.slice(1).replace(/\D/g, '')
    if (rest.length < 8 || rest.length > 15) return null
    return `+${rest}`
  }
  const digits = trimmed.replace(/\D/g, '')
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  if (digits.length >= 8 && digits.length <= 15) return `+${digits}`
  return null
}

export function maskPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '')
  if (!digits) return 'No phone'
  const last4 = digits.slice(-4) || '0000'
  return `(***) ***-${last4}`
}

export function waitMinutes(peopleAhead, averageServiceMinutes = DEFAULT_SERVICE_MINUTES) {
  const avg = Number(averageServiceMinutes) > 0 ? Number(averageServiceMinutes) : DEFAULT_SERVICE_MINUTES
  return Math.max(0, Number(peopleAhead) || 0) * avg
}

export function formatWaitLabel(minutes, { emptyAsNull = true } = {}) {
  const value = Number(minutes)
  if (!Number.isFinite(value) || value <= 0) return emptyAsNull ? null : '0 min'
  if (value <= 10) return `${value} min`
  const low = Math.round(value / 10) * 10
  return `${low}–${low + 10} min`
}

export function waitingEntries(entries, sessionId) {
  return entries
    .filter((entry) => entry.session_id === sessionId && entry.status === 'waiting')
    .sort((a, b) => a.order_index - b.order_index || String(a.joined_at).localeCompare(String(b.joined_at)))
}

export function servingEntry(entries, sessionId) {
  return entries.find((entry) => entry.session_id === sessionId && entry.status === 'serving') || null
}

export function deriveGuestStatus(entry, { serving, waiting }) {
  if (!entry) return 'unknown'
  if (entry.status === 'skipped') return 'skipped'
  if (entry.status === 'completed') return 'completed'
  if (entry.status === 'removed') return 'removed'
  if (entry.status === 'serving' || (serving && serving.id === entry.id)) return 'serving'
  const index = waiting.findIndex((item) => item.id === entry.id)
  if (index === 0 && serving) return 'next'
  return 'waiting'
}

export function peopleAheadFor(entry, { serving, waiting }) {
  if (!entry || entry.status !== 'waiting') return 0
  const index = waiting.findIndex((item) => item.id === entry.id)
  if (index < 0) return 0
  return (serving ? 1 : 0) + index
}

export function nowServingInitials(serving) {
  return serving?.initials || null
}

export function ordinal(n) {
  const value = Number(n)
  if (!Number.isFinite(value) || value < 1) return ''
  const remainder = value % 100
  if (remainder >= 11 && remainder <= 13) return `${value}th`
  switch (value % 10) {
    case 1: return `${value}st`
    case 2: return `${value}nd`
    case 3: return `${value}rd`
    default: return `${value}th`
  }
}

export function buildLiveLine(entry, session, entries) {
  const waiting = waitingEntries(entries, session.id)
  const serving = servingEntry(entries, session.id)
  const line = serving ? [serving, ...waiting] : waiting
  const youIndex = line.findIndex((item) => item.id === entry.id)
  if (youIndex < 0) return { place: null, placeLabel: null, rows: [] }
  const place = youIndex + 1
  return {
    place,
    placeLabel: place === 1 ? "You're first in line" : `You're ${ordinal(place)} in line`,
    rows: line.slice(0, youIndex + 1).map((item, index) => ({
      number: index + 1,
      initials: item.initials,
      displayName: partiallyMaskName(item.name),
      isYou: item.id === entry.id,
      atStation: item.status === 'serving',
    })),
  }
}

export function buildGuestView(entry, session, entries, { siteUrl } = {}) {
  const waiting = waitingEntries(entries, session.id)
  const serving = servingEntry(entries, session.id)
  const status = deriveGuestStatus(entry, { serving, waiting })
  const ahead = status === 'waiting' || status === 'next' ? peopleAheadFor(entry, { serving, waiting }) : 0
  const artistReady = Boolean(serving) || status === 'serving'
  const estimatedWaitMinutes = status === 'serving' ? 0 : waitMinutes(ahead, session.average_service_minutes)
  const firstUnstarted = !serving && waiting[0]?.id === entry.id
  const liveLine = ['waiting', 'next', 'serving'].includes(status)
    ? buildLiveLine(entry, session, entries)
    : { place: null, placeLabel: null, rows: [] }

  return {
    queueNumber: entry.display_number,
    name: entry.name,
    initials: entry.initials,
    status,
    peopleAhead: ahead,
    estimatedWaitMinutes,
    waitLabel: firstUnstarted ? null : formatWaitLabel(estimatedWaitMinutes),
    nowServingInitials: nowServingInitials(serving),
    queuePaused: Boolean(session.is_paused),
    queueOpen: Boolean(session.is_active),
    artistReady,
    firstInLine: firstUnstarted,
    liveLine,
    token: entry.guest_token,
    statusUrl: siteUrl ? statusUrlForToken(siteUrl, entry.guest_token) : undefined,
  }
}

export function publicSummary(session, entries) {
  const waiting = waitingEntries(entries, session.id)
  const serving = servingEntry(entries, session.id)
  const waitingCount = waiting.length + (serving ? 1 : 0)
  const totalMinutes = waitMinutes(waiting.length + (serving ? 1 : 0), session.average_service_minutes)
  return {
    open: Boolean(session.is_active),
    paused: Boolean(session.is_paused),
    waitingCount: waiting.length,
    serving: Boolean(serving),
    nowServingInitials: nowServingInitials(serving),
    totalInLine: waitingCount,
    estimatedWaitMinutes: waitMinutes(waiting.length, session.average_service_minutes),
    waitLabel: formatWaitLabel(waitMinutes(waiting.length, session.average_service_minutes)),
    totalQueueLabel: formatWaitLabel(totalMinutes),
    averageServiceMinutes: session.average_service_minutes,
  }
}

function averageServiceFromCompleted(entries, sessionId, fallback) {
  const completed = entries.filter((entry) => (
    entry.session_id === sessionId
    && entry.status === 'completed'
    && entry.started_at
    && entry.completed_at
  ))
  if (completed.length < 1) return fallback
  const total = completed.reduce((sum, entry) => {
    const start = new Date(entry.started_at).getTime()
    const end = new Date(entry.completed_at).getTime()
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return sum
    return sum + (end - start)
  }, 0)
  const counted = completed.filter((entry) => {
    const start = new Date(entry.started_at).getTime()
    const end = new Date(entry.completed_at).getTime()
    return Number.isFinite(start) && Number.isFinite(end) && end > start
  }).length
  if (!counted) return fallback
  return Math.max(1, Math.round(total / counted / 60000))
}

export function buildAdminView(session, entries, { now = Date.now() } = {}) {
  const waiting = waitingEntries(entries, session.id)
  const serving = servingEntry(entries, session.id)
  const skipped = entries
    .filter((entry) => entry.session_id === session.id && entry.status === 'skipped')
    .sort((a, b) => String(b.skipped_at).localeCompare(String(a.skipped_at)))
  const completed = entries.filter((entry) => entry.session_id === session.id && entry.status === 'completed')
  const liveAverage = averageServiceFromCompleted(entries, session.id, session.average_service_minutes)

  const serialize = (entry, extra = {}) => ({
    id: entry.id,
    displayNumber: entry.display_number,
    name: entry.name,
    initials: entry.initials,
    phoneMasked: maskPhone(entry.phone),
    status: extra.status || entry.status,
    orderIndex: entry.order_index,
    joinedAt: entry.joined_at,
    startedAt: entry.started_at,
    skippedAt: entry.skipped_at,
    completedAt: entry.completed_at,
    waitLabel: extra.waitLabel || null,
    peopleAhead: extra.peopleAhead ?? null,
    joinSmsSent: Boolean(entry.join_sms_sent_at),
    nextSmsSent: Boolean(entry.notification_next_sent_at),
    turnSmsSent: Boolean(entry.notification_turn_sent_at),
    smsError: entry.last_sms_error || null,
    smsErrorKind: entry.last_sms_kind || null,
    smsProviderMessageId: entry.last_sms_provider_id || null,
    smsStatus: entry.last_sms_status || null,
    smsStatusKind: entry.last_sms_status_kind || null,
    startedAgoMinutes: extra.startedAgoMinutes ?? null,
  })

  return {
    session: {
      id: session.id,
      open: Boolean(session.is_active),
      paused: Boolean(session.is_paused),
      averageServiceMinutes: session.average_service_minutes,
      eventName: session.event_name || null,
    },
    nowServing: serving ? serialize(serving, {
      status: 'serving',
      startedAgoMinutes: serving.started_at ? Math.max(0, Math.round((now - new Date(serving.started_at).getTime()) / 60000)) : 0,
    }) : null,
    upNext: waiting.map((entry, index) => serialize(entry, {
      status: serving && index === 0 ? 'next' : 'waiting',
      peopleAhead: (serving ? 1 : 0) + index,
      waitLabel: formatWaitLabel(waitMinutes((serving ? 1 : 0) + index, session.average_service_minutes)),
    })),
    skipped: skipped.map((entry) => serialize(entry)),
    stats: {
      served: completed.length,
      waiting: waiting.length,
      skipped: skipped.length,
      averageServiceMinutes: liveAverage,
      totalQueueLabel: formatWaitLabel(waitMinutes(waiting.length + (serving ? 1 : 0), session.average_service_minutes)),
    },
  }
}

function nextDisplayNumber(entries, sessionId) {
  return entries
    .filter((entry) => entry.session_id === sessionId)
    .reduce((max, entry) => Math.max(max, entry.display_number), 0) + 1
}

function nextOrderIndex(entries, sessionId) {
  const waiting = waitingEntries(entries, sessionId)
  const serving = servingEntry(entries, sessionId)
  const pool = serving ? waiting.concat(serving) : waiting
  if (!pool.length) return 1000
  return Math.max(...pool.map((entry) => entry.order_index)) + 1000
}

function findActiveByPhone(entries, sessionId, phone) {
  return entries.find((entry) => (
    entry.session_id === sessionId
    && entry.phone === phone
    && ACTIVE_PHONE_STATUSES.has(entry.status)
  )) || null
}

export function createMemoryQueue({
  now = () => Date.now(),
  randomId = () => `id-${Math.random().toString(36).slice(2, 10)}`,
  randomToken = () => `tok-${Math.random().toString(36).slice(2, 18)}`,
  siteUrl = 'https://ethnic-henna-design.vercel.app',
  sendSms,
} = {}) {
  const sessions = []
  const entries = []
  const smsLog = []

  const dispatchSms = async (entry, kind, body) => {
    const record = { kind, entryId: entry.id, phone: maskPhone(entry.phone), body }
    smsLog.push(record)
    if (!sendSms) return { ok: true, simulated: false }
    try {
      const result = await sendSms({ to: entry.phone, kind, body })
      if (result?.ok === false) throw new Error(result.error || 'SMS could not be sent')
      return result || { ok: true }
    } catch (error) {
      entry.last_sms_error = 'SMS could not be sent'
      entry.last_sms_kind = kind
      return { ok: false, error: error.message }
    }
  }

  function activeSession() {
    return sessions.find((session) => session.is_active) || null
  }

  function ensureSession() {
    let session = activeSession()
    if (!session) {
      session = {
        id: randomId(),
        is_active: true,
        is_paused: false,
        average_service_minutes: DEFAULT_SERVICE_MINUTES,
        event_name: null,
        created_at: new Date(now()).toISOString(),
        updated_at: new Date(now()).toISOString(),
      }
      sessions.push(session)
    }
    return session
  }

  function stamp(entry, fields) {
    Object.assign(entry, fields, { updated_at: new Date(now()).toISOString() })
    return entry
  }

  async function markJoinSms(entry, session) {
    if (entry.join_sms_sent_at) return
    const view = buildGuestView(entry, session, entries, { siteUrl })
    const result = await dispatchSms(entry, 'join', joinSms({
      queueNumber: view.queueNumber,
      waitLabel: view.waitLabel,
      statusUrl: view.statusUrl,
    }))
    if (result.ok && !result.simulated) {
      stamp(entry, { join_sms_sent_at: new Date(now()).toISOString(), last_sms_error: null, last_sms_kind: null, last_sms_provider_id: result.providerMessageId || null })
    } else if (result.simulated) {
      stamp(entry, { last_sms_error: 'SMS sending is disabled. This text was only previewed.', last_sms_kind: 'join' })
    }
  }

  async function syncNotifications(session) {
    const serving = servingEntry(entries, session.id)
    const waiting = waitingEntries(entries, session.id)
    if (serving && !serving.notification_turn_sent_at) {
      const result = await dispatchSms(serving, 'turn', turnSms())
      if (result.ok && !result.simulated) {
        stamp(serving, { notification_turn_sent_at: new Date(now()).toISOString(), last_sms_error: null, last_sms_kind: null, last_sms_provider_id: result.providerMessageId || null })
      } else if (result.simulated) {
        stamp(serving, { last_sms_error: 'SMS sending is disabled. This text was only previewed.', last_sms_kind: 'turn' })
      }
    }
    const nextGuest = serving ? waiting[0] : null
    if (nextGuest && !nextGuest.notification_next_sent_at && !nextGuest.notification_turn_sent_at) {
      const result = await dispatchSms(nextGuest, 'next', nextSms())
      if (result.ok && !result.simulated) {
        stamp(nextGuest, { notification_next_sent_at: new Date(now()).toISOString(), last_sms_error: null, last_sms_kind: null, last_sms_provider_id: result.providerMessageId || null })
      } else if (result.simulated) {
        stamp(nextGuest, { last_sms_error: 'SMS sending is disabled. This text was only previewed.', last_sms_kind: 'next' })
      }
    }
  }

  async function join({ name, phone, consent, bypassPause = false }) {
    const session = ensureSession()
    if (!session.is_active) return { ok: false, error: 'closed', message: "The henna queue isn't open right now." }
    if (session.is_paused && !bypassPause) return { ok: false, error: 'paused', message: 'Queue temporarily paused. We\'re catching up with everyone already waiting. Please check again shortly.' }
    const cleanName = sanitizeName(name)
    const rawPhone = String(phone || '').trim()
    const normalized = normalizePhone(phone)
    if (!cleanName) return { ok: false, error: 'invalid_name', message: 'Please enter your name.' }
    if (rawPhone && !normalized) return { ok: false, error: 'invalid_phone', message: 'Please enter a valid phone number.' }

    const existing = normalized ? findActiveByPhone(entries, session.id, normalized) : null
    if (existing) {
      return { ok: true, alreadyQueued: true, guest: buildGuestView(existing, session, entries, { siteUrl }) }
    }

    const entry = {
      id: randomId(),
      session_id: session.id,
      display_number: nextDisplayNumber(entries, session.id),
      name: cleanName,
      initials: initialsFromName(cleanName),
      phone: normalized,
      status: 'waiting',
      order_index: nextOrderIndex(entries, session.id),
      joined_at: new Date(now()).toISOString(),
      called_at: null,
      started_at: null,
      completed_at: null,
      skipped_at: null,
      removed_at: null,
      guest_token: randomToken(),
      notification_next_sent_at: null,
      notification_turn_sent_at: null,
      join_sms_sent_at: null,
      last_sms_error: null,
      sms_consent: Boolean(consent && normalized),
      created_at: new Date(now()).toISOString(),
      updated_at: new Date(now()).toISOString(),
    }
    entries.push(entry)
    if (consent && normalized) await markJoinSms(entry, session)
    await syncNotifications(session)
    return { ok: true, alreadyQueued: false, guest: buildGuestView(entry, session, entries, { siteUrl }) }
  }

  function guestByToken(token) {
    const session = activeSession()
    const entry = entries.find((item) => item.guest_token === token)
    if (!entry || !session || entry.session_id !== session.id || entry.status === 'removed') return null
    return buildGuestView(entry, session, entries, { siteUrl })
  }

  async function leave(token) {
    const session = activeSession()
    const entry = entries.find((item) => item.guest_token === token)
    if (!entry || !session || entry.session_id !== session.id) return { ok: false, error: 'not_found' }
    if (entry.status === 'completed' || entry.status === 'removed') return { ok: true, guest: buildGuestView(entry, session, entries, { siteUrl }) }
    const wasServing = entry.status === 'serving'
    stamp(entry, { status: 'removed', removed_at: new Date(now()).toISOString() })
    if (wasServing) {
      const nextGuest = waitingEntries(entries, session.id)[0]
      if (nextGuest) stamp(nextGuest, {
        status: 'serving',
        called_at: nextGuest.called_at || new Date(now()).toISOString(),
        started_at: new Date(now()).toISOString(),
        notification_turn_sent_at: null,
      })
    }
    await syncNotifications(session)
    return { ok: true, guest: buildGuestView(entry, session, entries, { siteUrl }) }
  }

  async function startServing() {
    const session = ensureSession()
    const serving = servingEntry(entries, session.id)
    if (serving) {
      await syncNotifications(session)
      return { ok: true, noop: true, admin: buildAdminView(session, entries, { now: now() }) }
    }
    const nextGuest = waitingEntries(entries, session.id)[0]
    if (!nextGuest) return { ok: false, error: 'empty_queue', message: 'Queue is empty.' }
    stamp(nextGuest, {
      status: 'serving',
      called_at: new Date(now()).toISOString(),
      started_at: new Date(now()).toISOString(),
      notification_turn_sent_at: null,
    })
    await syncNotifications(session)
    return { ok: true, noop: false, admin: buildAdminView(session, entries, { now: now() }) }
  }

  async function completeCurrent(expectedServingId) {
    const session = ensureSession()
    const serving = servingEntry(entries, session.id)
    if (!serving) return { ok: true, noop: true, admin: buildAdminView(session, entries, { now: now() }) }
    if (expectedServingId && serving.id !== expectedServingId) {
      return { ok: true, noop: true, admin: buildAdminView(session, entries, { now: now() }) }
    }
    stamp(serving, { status: 'completed', completed_at: new Date(now()).toISOString() })
    const nextGuest = waitingEntries(entries, session.id)[0]
    if (nextGuest) {
      stamp(nextGuest, {
        status: 'serving',
        called_at: nextGuest.called_at || new Date(now()).toISOString(),
        started_at: new Date(now()).toISOString(),
        notification_turn_sent_at: null,
      })
    }
    await syncNotifications(session)
    return { ok: true, noop: false, admin: buildAdminView(session, entries, { now: now() }) }
  }

  async function skipGuest(id) {
    const session = ensureSession()
    const entry = entries.find((item) => item.id === id && item.session_id === session.id)
    if (!entry) return { ok: false, error: 'not_found' }
    if (entry.status === 'completed' || entry.status === 'removed') return { ok: false, error: 'immutable' }
    const wasServing = entry.status === 'serving'
    stamp(entry, { status: 'skipped', skipped_at: new Date(now()).toISOString() })
    if (wasServing) {
      const nextGuest = waitingEntries(entries, session.id)[0]
      if (nextGuest) {
        stamp(nextGuest, {
          status: 'serving',
          called_at: nextGuest.called_at || new Date(now()).toISOString(),
          started_at: new Date(now()).toISOString(),
          notification_turn_sent_at: null,
        })
      }
    }
    await syncNotifications(session)
    return { ok: true, admin: buildAdminView(session, entries, { now: now() }) }
  }

  async function restoreGuest(id, { toFront = false } = {}) {
    const session = ensureSession()
    const entry = entries.find((item) => item.id === id && item.session_id === session.id)
    if (!entry || entry.status !== 'skipped') return { ok: false, error: 'not_found' }
    const waiting = waitingEntries(entries, session.id)
    const serving = servingEntry(entries, session.id)
    const orderIndex = toFront
      ? (waiting[0] ? waiting[0].order_index - 1 : (serving ? serving.order_index + 1 : 1000))
      : nextOrderIndex(entries, session.id)
    stamp(entry, { status: 'waiting', order_index: orderIndex, skipped_at: entry.skipped_at })
    await syncNotifications(session)
    return { ok: true, admin: buildAdminView(session, entries, { now: now() }) }
  }

  async function removeGuest(id) {
    const session = ensureSession()
    const entry = entries.find((item) => item.id === id && item.session_id === session.id)
    if (!entry) return { ok: false, error: 'not_found' }
    if (entry.status === 'completed' || entry.status === 'removed') return { ok: false, error: 'immutable' }
    const wasServing = entry.status === 'serving'
    stamp(entry, { status: 'removed', removed_at: new Date(now()).toISOString() })
    if (wasServing) {
      const nextGuest = waitingEntries(entries, session.id)[0]
      if (nextGuest) {
        stamp(nextGuest, {
          status: 'serving',
          called_at: nextGuest.called_at || new Date(now()).toISOString(),
          started_at: new Date(now()).toISOString(),
          notification_turn_sent_at: null,
        })
      }
    }
    await syncNotifications(session)
    return { ok: true, admin: buildAdminView(session, entries, { now: now() }) }
  }

  async function moveGuest(id, direction) {
    if (!['up', 'down'].includes(direction)) return { ok: false, error: 'invalid_direction', message: 'Choose move up or move down.' }
    const session = ensureSession()
    const waiting = waitingEntries(entries, session.id)
    const index = waiting.findIndex((item) => item.id === id)
    if (index < 0) return { ok: false, error: 'not_found' }
    const swapWith = direction === 'up' ? index - 1 : index + 1
    if (swapWith < 0 || swapWith >= waiting.length) return { ok: true, admin: buildAdminView(session, entries, { now: now() }) }
    const current = waiting[index]
    const other = waiting[swapWith]
    const currentOrder = current.order_index
    stamp(current, { order_index: other.order_index })
    stamp(other, { order_index: currentOrder })
    await syncNotifications(session)
    return { ok: true, admin: buildAdminView(session, entries, { now: now() }) }
  }

  async function serveNow(id) {
    const session = ensureSession()
    const entry = entries.find((item) => item.id === id && item.session_id === session.id)
    if (!entry || !['waiting', 'skipped'].includes(entry.status)) return { ok: false, error: 'not_found' }
    const serving = servingEntry(entries, session.id)
    if (serving && serving.id !== entry.id) {
      const waiting = waitingEntries(entries, session.id)
      const front = waiting[0]?.order_index ?? serving.order_index
      stamp(serving, { status: 'waiting', order_index: front - 1, started_at: serving.started_at })
    }
    stamp(entry, {
      status: 'serving',
      order_index: entry.order_index,
      called_at: entry.called_at || new Date(now()).toISOString(),
      started_at: new Date(now()).toISOString(),
      notification_turn_sent_at: null,
    })
    await syncNotifications(session)
    return { ok: true, admin: buildAdminView(session, entries, { now: now() }) }
  }

  async function addWalkIn(payload) {
    return join({
      name: payload.name,
      phone: payload.phone,
      consent: Boolean(payload.consent),
      bypassPause: true,
      requireConsent: false,
    })
  }

  async function retrySms(id) {
    const session = ensureSession()
    const entry = entries.find((item) => item.id === id && item.session_id === session.id)
    let kind = entry?.last_sms_kind
    if (!entry || !entry.sms_consent || !entry.last_sms_error || !['join', 'next', 'turn'].includes(kind)) {
      return { ok: false, error: 'not_retryable', message: 'There is no failed text to retry for this guest.' }
    }
    let body
    if (kind === 'join') {
      const guest = buildGuestView(entry, session, entries, { siteUrl })
      body = joinSms({ queueNumber: guest.queueNumber, waitLabel: guest.waitLabel, statusUrl: guest.statusUrl })
    } else if (kind === 'turn' || (kind === 'next' && entry.status === 'serving')) {
      kind = 'turn'
      if (entry.status !== 'serving') return { ok: false, error: 'stale_action', message: 'That guest is no longer being served.' }
      body = turnSms()
    } else {
      const waiting = waitingEntries(entries, session.id)
      const serving = servingEntry(entries, session.id)
      if (entry.status !== 'waiting' || !serving || waiting[0]?.id !== entry.id) {
        return { ok: false, error: 'stale_action', message: 'That guest is no longer next in line.' }
      }
      body = nextSms()
    }
    const result = await dispatchSms(entry, kind, body)
    if (result.ok && !result.simulated) {
      const sentAt = new Date(now()).toISOString()
      const field = kind === 'join' ? 'join_sms_sent_at' : kind === 'next' ? 'notification_next_sent_at' : 'notification_turn_sent_at'
      stamp(entry, { [field]: sentAt, last_sms_error: null, last_sms_kind: null, last_sms_provider_id: result.providerMessageId || null })
    } else if (result.simulated) {
      stamp(entry, { last_sms_error: 'SMS sending is disabled. This text was only previewed.', last_sms_kind: kind })
    }
    if (!result.ok || result.simulated) {
      return { ok: false, error: 'sms_failed', message: entry.last_sms_error, admin: buildAdminView(session, entries, { now: now() }) }
    }
    await syncNotifications(session)
    return { ok: true, admin: buildAdminView(session, entries, { now: now() }) }
  }

  function pause() {
    const session = ensureSession()
    session.is_paused = true
    session.updated_at = new Date(now()).toISOString()
    return { ok: true, admin: buildAdminView(session, entries, { now: now() }) }
  }

  function resume() {
    const session = ensureSession()
    session.is_paused = false
    session.updated_at = new Date(now()).toISOString()
    return { ok: true, admin: buildAdminView(session, entries, { now: now() }) }
  }

  function reset() {
    const session = activeSession()
    if (session) {
      session.is_active = false
      session.is_paused = false
      session.updated_at = new Date(now()).toISOString()
    }
    const next = ensureSession()
    return { ok: true, admin: buildAdminView(next, entries, { now: now() }) }
  }

  function summary() {
    const session = ensureSession()
    return publicSummary(session, entries)
  }

  function admin() {
    const session = ensureSession()
    return buildAdminView(session, entries, { now: now() })
  }

  return {
    join,
    leave,
    guestByToken,
    startServing,
    completeCurrent,
    skipGuest,
    restoreGuest,
    removeGuest,
    moveGuest,
    serveNow,
    addWalkIn,
    retrySms,
    pause,
    resume,
    reset,
    summary,
    admin,
    smsLog,
    sessions,
    entries,
  }
}

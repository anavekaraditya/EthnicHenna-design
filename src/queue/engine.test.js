import test from 'node:test'
import assert from 'node:assert/strict'
import { createMemoryQueue, formatWaitLabel, normalizePhone, waitMinutes } from './engine.js'

function queue() {
  return createMemoryQueue({
    randomId: (() => { let n = 0; return () => `id-${++n}` })(),
    randomToken: (() => { let n = 0; return () => `token-${++n}` })(),
  })
}

test('normalizes US phone numbers to E.164', () => {
  assert.equal(normalizePhone('9255551234'), '+19255551234')
  assert.equal(normalizePhone('(925) 555-1234'), '+19255551234')
  assert.equal(normalizePhone('+44 7700 900123'), '+447700900123')
  assert.equal(normalizePhone('12'), null)
})

test('wait estimates use configured minutes per person', () => {
  assert.equal(waitMinutes(0, 10), 0)
  assert.equal(waitMinutes(1, 10), 10)
  assert.equal(waitMinutes(7, 10), 70)
  assert.equal(formatWaitLabel(40), '40–50 min')
})

test('three guests joining receive 1, 2, 3', async () => {
  const q = queue()
  const a = await q.join({ name: 'Ananya Sharma', phone: '9255550001', consent: true })
  const b = await q.join({ name: 'Maya Kapoor', phone: '9255550002', consent: true })
  const c = await q.join({ name: 'Rina Patel', phone: '9255550003', consent: true })
  assert.equal(a.guest.queueNumber, 1)
  assert.equal(b.guest.queueNumber, 2)
  assert.equal(c.guest.queueNumber, 3)
  assert.equal(c.guest.peopleAhead, 2)
  assert.equal(c.guest.liveLine.placeLabel, "You're 3rd in line")
  assert.equal(c.guest.liveLine.rows[0].displayName, 'AS')
  assert.equal(c.guest.liveLine.rows[1].displayName, 'MK')
  assert.equal(c.guest.liveLine.rows[2].displayName, 'R••• P••••')
  assert.equal(c.guest.liveLine.rows[2].isYou, true)
  assert.equal(a.guest.status, 'waiting')
  assert.equal(a.guest.firstInLine, true)
  assert.equal(q.smsLog.filter((item) => item.kind === 'join').length, 3)
  assert.equal(q.smsLog.filter((item) => item.kind === 'turn').length, 0)
})

test('guest can join without a phone number or SMS consent', async () => {
  const q = queue()
  const result = await q.join({ name: 'Maya Kapoor' })

  assert.equal(result.ok, true)
  assert.equal(q.admin().upNext[0].phoneMasked, 'No phone')
  assert.equal(q.entries[0].phone, null)
  assert.equal(q.entries[0].sms_consent, false)
  assert.equal(q.smsLog.length, 0)
})

test('duplicate phone returns existing place instead of a second ticket', async () => {
  const q = queue()
  const first = await q.join({ name: 'Ananya', phone: '9255551234', consent: true })
  const second = await q.join({ name: 'Ananya', phone: '925-555-1234', consent: true })
  assert.equal(second.alreadyQueued, true)
  assert.equal(second.guest.token, first.guest.token)
  assert.equal(q.entries.length, 1)
})

test('completing person 1 makes person 2 serving and person 3 next', async () => {
  const q = queue()
  const a = await q.join({ name: 'AS', phone: '9255550001', consent: true })
  const b = await q.join({ name: 'MK', phone: '9255550002', consent: true })
  const c = await q.join({ name: 'RP', phone: '9255550003', consent: true })
  await q.startServing()
  assert.equal(q.guestByToken(a.guest.token).status, 'serving')
  assert.equal(q.guestByToken(b.guest.token).status, 'next')
  assert.ok(q.smsLog.some((item) => item.kind === 'turn' && item.entryId === 'id-2'))
  assert.ok(q.smsLog.some((item) => item.kind === 'next' && item.entryId === 'id-3'))

  await q.completeCurrent(a.guest.token && q.entries[0].id)
  assert.equal(q.entries[0].status, 'completed')
  assert.equal(q.guestByToken(b.guest.token).status, 'serving')
  assert.equal(q.guestByToken(c.guest.token).status, 'next')
  assert.equal(q.smsLog.filter((item) => item.kind === 'turn').length, 2)
  assert.equal(q.smsLog.filter((item) => item.kind === 'next').length, 2)
})

test('duplicate completion does not complete two guests', async () => {
  const q = queue()
  await q.join({ name: 'AS', phone: '9255550001', consent: true })
  await q.join({ name: 'MK', phone: '9255550002', consent: true })
  await q.join({ name: 'RP', phone: '9255550003', consent: true })
  await q.startServing()
  const servingId = q.entries.find((entry) => entry.status === 'serving').id
  await q.completeCurrent(servingId)
  await q.completeCurrent(servingId)
  const completed = q.entries.filter((entry) => entry.status === 'completed')
  const serving = q.entries.filter((entry) => entry.status === 'serving')
  assert.equal(completed.length, 1)
  assert.equal(serving.length, 1)
  assert.equal(serving[0].name, 'MK')
})

test('skipping the next guest advances the following guest', async () => {
  const q = queue()
  await q.join({ name: 'AS', phone: '9255550001', consent: true })
  const b = await q.join({ name: 'MK', phone: '9255550002', consent: true })
  const c = await q.join({ name: 'RP', phone: '9255550003', consent: true })
  await q.startServing()
  await q.skipGuest(q.entries.find((entry) => entry.name === 'MK').id)
  assert.equal(q.guestByToken(b.guest.token).status, 'skipped')
  assert.equal(q.guestByToken(c.guest.token).status, 'next')
  assert.ok(q.smsLog.some((item) => item.kind === 'next' && item.entryId === q.entries.find((entry) => entry.name === 'RP').id))
})

test('serving a previously skipped guest sends a fresh turn text', async () => {
  const q = queue()
  const a = await q.join({ name: 'AS', phone: '9255550001', consent: true })
  await q.join({ name: 'MK', phone: '9255550002', consent: true })
  await q.startServing()
  const aId = q.entries.find((entry) => entry.guest_token === a.guest.token).id
  await q.skipGuest(aId)
  await q.restoreGuest(aId)
  await q.serveNow(aId)
  assert.equal(q.smsLog.filter((item) => item.kind === 'turn' && item.entryId === aId).length, 2)
})

test('invalid move directions do not move a guest', async () => {
  const q = queue()
  await q.join({ name: 'AS', phone: '9255550001', consent: true })
  await q.join({ name: 'MK', phone: '9255550002', consent: true })
  const before = q.admin().upNext.map((guest) => guest.id)
  const result = await q.moveGuest(before[0], 'sideways')
  assert.equal(result.ok, false)
  assert.deepEqual(q.admin().upNext.map((guest) => guest.id), before)
})

test('reordering updates positions without extra turn texts', async () => {
  const q = queue()
  await q.join({ name: 'AS', phone: '9255550001', consent: true })
  await q.join({ name: 'MK', phone: '9255550002', consent: true })
  await q.join({ name: 'RP', phone: '9255550003', consent: true })
  await q.startServing()
  const turnCount = q.smsLog.filter((item) => item.kind === 'turn').length
  const mk = q.entries.find((entry) => entry.name === 'MK')
  const rp = q.entries.find((entry) => entry.name === 'RP')
  await q.moveGuest(rp.id, 'up')
  assert.equal(q.admin().upNext[0].name, 'RP')
  assert.equal(q.admin().upNext[1].name, 'MK')
  assert.equal(q.guestByToken(rp.guest_token).status, 'next')
  assert.equal(q.guestByToken(mk.guest_token).status, 'waiting')
  assert.equal(q.smsLog.filter((item) => item.kind === 'turn').length, turnCount)
})

test('removing a waiting guest closes the gap', async () => {
  const q = queue()
  await q.join({ name: 'AS', phone: '9255550001', consent: true })
  await q.join({ name: 'MK', phone: '9255550002', consent: true })
  await q.join({ name: 'RP', phone: '9255550003', consent: true })
  await q.startServing()
  await q.removeGuest(q.entries.find((entry) => entry.name === 'MK').id)
  assert.equal(q.admin().upNext[0].name, 'RP')
  assert.equal(q.admin().upNext.length, 1)
})

test('leaving while being served advances the queue', async () => {
  const q = queue()
  const serving = await q.join({ name: 'AS', phone: '9255550001', consent: true })
  const next = await q.join({ name: 'MK', phone: '9255550002', consent: true })
  await q.startServing()
  await q.leave(serving.guest.token)
  assert.equal(q.guestByToken(serving.guest.token), null)
  assert.equal(q.guestByToken(next.guest.token).status, 'serving')
})

test('reset closes the current session and starts a clean line', async () => {
  const q = queue()
  await q.join({ name: 'AS', phone: '9255550001', consent: true })
  await q.startServing()
  q.reset()
  assert.equal(q.sessions.filter((session) => session.is_active).length, 1)
  assert.equal(q.admin().upNext.length, 0)
  assert.equal(q.admin().nowServing, null)
  const next = await q.join({ name: 'New Guest', phone: '9255550099', consent: true })
  assert.equal(next.guest.queueNumber, 1)
  assert.equal(q.entries.filter((entry) => entry.status === 'serving' || entry.status === 'completed').length, 1)
})

test('join SMS is not duplicated on refresh-style duplicate requests', async () => {
  const q = queue()
  await q.join({ name: 'AS', phone: '9255550001', consent: true })
  await q.join({ name: 'AS', phone: '9255550001', consent: true })
  assert.equal(q.smsLog.filter((item) => item.kind === 'join').length, 1)
})

test('a previewed SMS is not marked sent and can be retried', async () => {
  const responses = [
    { ok: true, simulated: true },
    { ok: true, providerMessageId: 'message-1' },
  ]
  const q = createMemoryQueue({
    randomId: () => 'guest-1',
    randomToken: () => 'token-1',
    sendSms: async () => responses.shift(),
  })
  const joined = await q.join({ name: 'Ananya', phone: '9255550001', consent: true })
  const entry = q.entries[0]
  assert.equal(entry.join_sms_sent_at, null)
  assert.equal(entry.last_sms_kind, 'join')
  const retried = await q.retrySms(entry.id)
  assert.equal(retried.ok, true)
  assert.ok(entry.join_sms_sent_at)
  assert.equal(entry.last_sms_error, null)
  assert.equal(joined.guest.token, 'token-1')
})

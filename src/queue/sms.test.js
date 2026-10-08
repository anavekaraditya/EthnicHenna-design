import test from 'node:test'
import assert from 'node:assert/strict'
import { sendSms } from '../../api/_lib/sms.js'

function withEnvironment(values, run) {
  const previous = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]))
  for (const [key, value] of Object.entries(values)) process.env[key] = value
  return Promise.resolve()
    .then(run)
    .finally(() => {
      for (const [key, value] of Object.entries(previous)) {
        if (value === undefined) delete process.env[key]
        else process.env[key] = value
      }
    })
}

test('disabled SMS is reported as a preview and redacts ticket links in logs', async () => {
  await withEnvironment({ SMS_ENABLED: 'false' }, async () => {
    const originalInfo = console.info
    let log = ''
    console.info = (...values) => { log = JSON.stringify(values) }
    try {
      const result = await sendSms({ to: '+19255550000', kind: 'join', body: 'Track here: https://example.com/queue?t=secret-token' })
      assert.equal(result.simulated, true)
      assert.equal(log.includes('secret-token'), false)
      assert.equal(log.includes('[link]'), true)
    } finally {
      console.info = originalInfo
    }
  })
})

test('Telnyx acceptance returns its message id and recipient status', async () => {
  await withEnvironment({
    SMS_ENABLED: 'true',
    TELNYX_API_KEY: 'test-key',
    TELNYX_PHONE_NUMBER: '+19255559999',
    TELNYX_MESSAGING_PROFILE_ID: '',
  }, async () => {
    const originalFetch = globalThis.fetch
    let sentPayload
    globalThis.fetch = async (url, options) => {
      assert.equal(url, 'https://api.telnyx.com/v2/messages')
      sentPayload = JSON.parse(options.body)
      return {
        ok: true,
        status: 200,
        json: async () => ({ data: { id: 'message-123', to: [{ status: 'queued' }] } }),
      }
    }
    try {
      const result = await sendSms({ to: '+19255550000', kind: 'turn', body: 'Your turn.' })
      assert.deepEqual(sentPayload, { to: '+19255550000', text: 'Your turn.', from: '+19255559999' })
      assert.equal(result.ok, true)
      assert.equal(result.providerMessageId, 'message-123')
      assert.equal(result.providerStatus, 'queued')
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})

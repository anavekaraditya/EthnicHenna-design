import test from 'node:test'
import assert from 'node:assert/strict'
import { generateKeyPairSync, sign } from 'node:crypto'
import { verifyTelnyxSignature } from './telnyxWebhook.js'

test('verifies a Telnyx Ed25519 webhook signature over timestamp and raw body', () => {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519')
  const rawPublicKey = publicKey.export({ format: 'der', type: 'spki' }).subarray(-32).toString('base64')
  const timestamp = String(Math.floor(Date.now() / 1000))
  const rawBody = Buffer.from('{"data":{"event_type":"message.sent"}}')
  const signature = sign(null, Buffer.concat([Buffer.from(`${timestamp}|`), rawBody]), privateKey).toString('base64')

  assert.equal(verifyTelnyxSignature({ rawBody, signature, timestamp, publicKey: rawPublicKey }), true)
  assert.equal(verifyTelnyxSignature({ rawBody: Buffer.from(`${rawBody} `), signature, timestamp, publicKey: rawPublicKey }), false)
})

test('rejects stale webhook signatures', () => {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519')
  const rawPublicKey = publicKey.export({ format: 'der', type: 'spki' }).subarray(-32).toString('base64')
  const timestamp = String(Math.floor(Date.now() / 1000) - 301)
  const rawBody = Buffer.from('{}')
  const signature = sign(null, Buffer.concat([Buffer.from(`${timestamp}|`), rawBody]), privateKey).toString('base64')

  assert.equal(verifyTelnyxSignature({ rawBody, signature, timestamp, publicKey: rawPublicKey }), false)
})

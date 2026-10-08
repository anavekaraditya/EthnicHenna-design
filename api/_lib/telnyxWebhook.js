import { createPublicKey, verify } from 'node:crypto'

const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex')
export const TELNYX_TIMESTAMP_TOLERANCE_SECONDS = 5 * 60

function publicKeyFromEnv(value) {
  const raw = String(value || '').trim()
  if (!raw) throw new Error('TELNYX_PUBLIC_KEY is not configured')
  if (raw.includes('BEGIN PUBLIC KEY')) return createPublicKey(raw)

  const bytes = Buffer.from(raw, 'base64')
  if (bytes.length !== 32) throw new Error('TELNYX_PUBLIC_KEY must be a base64 Ed25519 public key')
  return createPublicKey({
    key: Buffer.concat([ED25519_SPKI_PREFIX, bytes]),
    format: 'der',
    type: 'spki',
  })
}

export function verifyTelnyxSignature({ rawBody, signature, timestamp, publicKey, now = Date.now() }) {
  const timestampText = String(timestamp || '')
  const seconds = Number(timestampText)
  if (!Number.isInteger(seconds)) return false
  if (Math.abs(Math.floor(now / 1000) - seconds) > TELNYX_TIMESTAMP_TOLERANCE_SECONDS) return false

  let signatureBytes
  try {
    signatureBytes = Buffer.from(String(signature || ''), 'base64')
    if (signatureBytes.length !== 64) return false
    const key = publicKeyFromEnv(publicKey)
    const signedPayload = Buffer.concat([
      Buffer.from(`${timestampText}|`, 'utf8'),
      Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody),
    ])
    return verify(null, signedPayload, key, signatureBytes)
  } catch {
    return false
  }
}

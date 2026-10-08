import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

export function isFirebaseConfigured() {
  return Boolean(
    process.env.FIREBASE_PROJECT_ID
    && process.env.FIREBASE_CLIENT_EMAIL
    && process.env.FIREBASE_PRIVATE_KEY,
  )
}

function sanitizeEnvValue(raw) {
  let value = String(raw || '').trim()
  value = value.replace(/^["']/, '').replace(/["']\s*,?\s*$/, '')
  value = value.replace(/\\n/g, '\n').replace(/\\"/g, '"').trim()
  return value
}

function normalizePrivateKey(raw) {
  let key = sanitizeEnvValue(raw)
  if (!key.endsWith('\n')) key += '\n'
  return key
}

function resolveProjectId() {
  const email = sanitizeEnvValue(process.env.FIREBASE_CLIENT_EMAIL)
  const configured = sanitizeEnvValue(process.env.FIREBASE_PROJECT_ID)
  const fromEmail = email.split('@')[1]?.replace(/\.iam\.gserviceaccount\.com$/i, '')
  return fromEmail || configured
}

export function firebaseDb() {
  if (!isFirebaseConfigured()) {
    const error = new Error('Queue database is not configured.')
    error.code = 'unconfigured'
    throw error
  }
  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId: resolveProjectId(),
        clientEmail: sanitizeEnvValue(process.env.FIREBASE_CLIENT_EMAIL),
        privateKey: normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY),
      }),
    })
  }
  return getFirestore()
}

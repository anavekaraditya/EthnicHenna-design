import * as localQueue from './localQueue.js'
import { isFirebaseConfigured } from './firebase.js'
import * as firebaseQueue from './queueStore.js'

export function getQueueBackend() {
  if (isFirebaseConfigured()) return firebaseQueue
  if (process.env.VERCEL) {
    const error = new Error('Queue database is not configured.')
    error.code = 'unconfigured'
    throw error
  }
  return localQueue
}

import { GUEST_TOKEN_STORAGE_KEY } from './engine.js'

async function request(url, options = {}) {
  const { headers, ...requestOptions } = options
  const response = await fetch(url, {
    ...requestOptions,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(headers || {}) },
  })
  const data = await response.json().catch(() => ({}))
  if (!data.message && !response.ok) {
    data.message = response.status === 404
      ? 'The queue service is not available yet.'
      : 'Could not join the queue. Please try again.'
  }
  return { response, data }
}

export const queueApi = {
  tokenKey: GUEST_TOKEN_STORAGE_KEY,
  readToken() {
    try {
      const params = new URLSearchParams(window.location.search)
      return params.get('t') || params.get('token') || localStorage.getItem(GUEST_TOKEN_STORAGE_KEY)
    } catch {
      return null
    }
  },
  saveToken(token) {
    if (!token) return
    try {
      localStorage.setItem(GUEST_TOKEN_STORAGE_KEY, token)
    } catch {
      // The ticket URL still preserves recovery when browser storage is unavailable.
    }
    const url = new URL(window.location.href)
    url.searchParams.set('t', token)
    window.history.replaceState({}, '', `${url.pathname}?t=${encodeURIComponent(token)}`)
  },
  clearToken() {
    try {
      localStorage.removeItem(GUEST_TOKEN_STORAGE_KEY)
    } catch {
      // Clearing the URL is enough when browser storage is unavailable.
    }
    const url = new URL(window.location.href)
    url.search = ''
    window.history.replaceState({}, '', url.pathname)
  },
  summary: () => request('/api/queue/summary'),
  join: (body) => request('/api/queue/join', { method: 'POST', body: JSON.stringify(body) }),
  status: (token) => request(`/api/queue/status?t=${encodeURIComponent(token)}`),
  pushConfig: () => request('/api/queue/push'),
  enablePush: (token, subscription) => request('/api/queue/push', { method: 'POST', body: JSON.stringify({ token, subscription }) }),
  disablePush: (token) => request('/api/queue/push', { method: 'DELETE', body: JSON.stringify({ token }) }),
  leave: (token) => request('/api/queue/leave', { method: 'POST', body: JSON.stringify({ token }) }),
  recover: (phone) => request('/api/queue/recover', { method: 'POST', body: JSON.stringify({ phone }) }),
  authMe: () => request('/api/queue/auth'),
  login: (password) => request('/api/queue/auth', { method: 'POST', body: JSON.stringify({ password }) }),
  logout: () => request('/api/queue/auth', { method: 'DELETE' }),
  manage: () => request('/api/queue/manage'),
  action: (body) => request('/api/queue/manage', { method: 'POST', body: JSON.stringify(body) }),
}

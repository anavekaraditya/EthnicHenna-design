import React, { useEffect, useState } from 'react'
import { queueApi } from './queueApi.js'

function isIOSDevice() {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

function isInstalledWebApp() {
  return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true
}

function applicationServerKey(value) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0))
}

export function PushOptIn({ token }) {
  const [state, setState] = useState('loading')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let active = true
    async function readState() {
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
        setState(isIOSDevice() && !isInstalledWebApp() ? 'install' : 'unsupported')
        return
      }
      try {
        const response = await queueApi.pushConfig()
        if (!active) return
        if (!response.data.configured) {
          setState('unconfigured')
          return
        }
      } catch {
        if (active) setState('unconfigured')
        return
      }
      if (Notification.permission === 'denied') {
        setState('blocked')
        return
      }
      try {
        const registration = await navigator.serviceWorker.getRegistration('/queue-sw.js')
        const subscription = await registration?.pushManager.getSubscription()
        if (!active) return
        setState(subscription ? 'enabled' : 'off')
      } catch {
        if (active) setState('off')
      }
    }
    readState()
    return () => { active = false }
  }, [token])

  async function enable() {
    if (isIOSDevice() && !isInstalledWebApp()) {
      setState('install')
      return
    }
    setBusy(true)
    try {
      const configResult = await queueApi.pushConfig()
      if (!configResult.data.ok || !configResult.data.publicKey) throw new Error('Push notifications are not configured yet.')
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setState(permission === 'denied' ? 'blocked' : 'off')
        return
      }
      const registration = await navigator.serviceWorker.register('/queue-sw.js', { scope: '/' })
      await navigator.serviceWorker.ready
      let subscription = await registration.pushManager.getSubscription()
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationServerKey(configResult.data.publicKey),
        })
      }
      const result = await queueApi.enablePush(token, subscription.toJSON())
      if (!result.data.ok) throw new Error(result.data.message || 'Could not enable notifications.')
      setState('enabled')
    } catch (error) {
      setState('error')
    } finally {
      setBusy(false)
    }
  }

  async function disable() {
    setBusy(true)
    try {
      const registration = await navigator.serviceWorker.getRegistration('/queue-sw.js')
      const subscription = await registration?.pushManager.getSubscription()
      await queueApi.disablePush(token)
      await subscription?.unsubscribe()
      setState('off')
    } catch {
      setState('error')
    } finally {
      setBusy(false)
    }
  }

  if (state === 'loading') return null
  if (state === 'enabled') {
    return (
      <div className="queue-push-control" role="status">
        <p className="queue-copy">Browser alerts are on. We’ll notify you when you’re next and when it’s your turn.</p>
        <button className="queue-text-button" type="button" disabled={busy} onClick={disable}>Turn off alerts</button>
      </div>
    )
  }
  if (state === 'install') {
    return <p className="queue-copy queue-push-note">On iPhone or iPad, tap Share → Add to Home Screen, open the queue from its new icon, then turn on alerts.</p>
  }
  if (state === 'unsupported') {
    return <p className="queue-copy queue-push-note">This browser can’t send background alerts. Keep this page open to see queue updates.</p>
  }
  if (state === 'blocked') {
    return <p className="queue-copy queue-push-note">Notifications are blocked in your browser settings. You can still check your place on this page.</p>
  }
  if (state === 'unconfigured') {
    return <p className="queue-copy queue-push-note">Browser alerts aren’t set up yet. You can still check your place on this page.</p>
  }
  return (
    <div className="queue-push-control">
      <button className="queue-secondary" type="button" disabled={busy} onClick={enable}>
        {busy ? 'Turning on alerts…' : 'Turn on browser alerts'}
      </button>
      {state === 'error' && <p className="queue-copy queue-push-note" role="status">Couldn’t enable alerts. Please try again.</p>}
    </div>
  )
}

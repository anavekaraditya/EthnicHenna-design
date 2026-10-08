import React, { useEffect, useRef, useState } from 'react'
import { SMS_CONSENT_LABEL } from './smsCopy.js'
import { queueApi } from './queueApi.js'

function SettingsMenu({ open, onToggle, children }) {
  return (
    <div className="queue-overflow">
      <button className="queue-icon-button" type="button" aria-expanded={open} aria-haspopup="true" onClick={onToggle}>Menu</button>
      {open && <div className="queue-menu">{children}</div>}
    </div>
  )
}

export function QueueManagePage() {
  const [auth, setAuth] = useState(null)
  const [password, setPassword] = useState('')
  const [admin, setAdmin] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  const [openRow, setOpenRow] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [skippedOpen, setSkippedOpen] = useState(false)
  const [qrOpen, setQrOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)
  const [serveConfirm, setServeConfirm] = useState(null)
  const [walkIn, setWalkIn] = useState({ name: '', phone: '', consent: true })
  const requestVersion = useRef(0)

  async function refresh() {
    const version = ++requestVersion.current
    try {
      const { data } = await queueApi.manage()
      if (version !== requestVersion.current) return
      if (data.ok) setAdmin(data.admin)
      else if (data.error === 'unauthorized') setAuth(false)
      else setError(data.message || 'Could not load the queue.')
    } catch {
      if (version === requestVersion.current) setError('Could not connect to the queue. Check your connection and try again.')
    }
  }

  useEffect(() => {
    let cancelled = false
    queueApi.authMe().then(({ data }) => {
      if (cancelled) return
      setAuth(Boolean(data.authenticated))
      if (data.authenticated) refresh()
    }).catch(() => {
      if (!cancelled) {
        setAuth(false)
        setError('Could not check your sign-in. Reload the page and try again.')
      }
    })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!auth) return undefined
    const timer = setInterval(refresh, 8000)
    const onFocus = () => refresh()
    window.addEventListener('focus', onFocus)
    return () => {
      clearInterval(timer)
      window.removeEventListener('focus', onFocus)
    }
  }, [auth])

  async function login(event) {
    event.preventDefault()
    setBusy('login')
    setError('')
    try {
      const { data } = await queueApi.login(password)
      if (data.ok) {
        setAuth(true)
        refresh()
      } else {
        setError(data.message || 'That passcode doesn’t match.')
      }
    } catch {
      setError('Could not sign in. Check your connection and try again.')
    } finally {
      setBusy('')
    }
  }

  async function act(action, extra = {}) {
    const { busyKey, ...payload } = extra
    const key = busyKey || action
    requestVersion.current += 1
    setBusy(key)
    setError('')
    try {
      const { data } = await queueApi.action({ action, ...payload })
      if (data.ok) {
        setAdmin(data.admin)
        if (data.alreadyQueued) setError("You're already in the queue.")
        return true
      } else {
        if (data.admin) setAdmin(data.admin)
        setError(data.message || 'That didn’t work. Try again.')
        if (data.error === 'stale_action') refresh()
        return false
      }
    } catch {
      setError('Could not reach the queue. Check your connection and try again.')
      return false
    } finally {
      setBusy('')
      setOpenRow(null)
      setServeConfirm(null)
    }
  }

  if (auth === null) {
    return <div className="queue-page queue-manage"><p className="queue-copy">Loading…</p></div>
  }

  if (!auth) {
    return (
      <div className="queue-page queue-manage">
        <a className="queue-brand" href="/" aria-label="Ethnic Henna home">
          <img src="/brand/logo-mark.png" alt="" />
          <span>Ethnic Henna</span>
        </a>
        <form className="queue-card queue-form" onSubmit={login}>
          <h1>Henna Queue</h1>
          <p className="queue-lede">Artist sign-in</p>
          <label htmlFor="queue-admin-password">Passcode</label>
          <input id="queue-admin-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />
          {import.meta.env.DEV && <p className="queue-copy">Local development passcode: henna-queue</p>}
          <button className="queue-primary" type="submit" disabled={busy === 'login'}>{busy === 'login' ? 'Signing in…' : 'Sign in'}</button>
          {error && <p className="queue-error" role="alert">{error}</p>}
        </form>
      </div>
    )
  }

  const serving = admin?.nowServing
  const stats = admin?.stats

  return (
    <div className="queue-page queue-manage">
      <header className="queue-admin-header">
        <div>
          <p className="queue-kicker">Henna Queue</p>
          <p className="queue-status-pill" data-state={admin?.session?.paused ? 'paused' : 'open'}>{admin?.session?.paused ? 'PAUSED' : 'OPEN'}</p>
          <p>{stats?.waiting ?? 0} waiting{stats?.totalQueueLabel ? ` · ~${stats.totalQueueLabel} total queue` : ''}</p>
        </div>
        <SettingsMenu open={menuOpen} onToggle={() => setMenuOpen((value) => !value)}>
          <button type="button" onClick={() => { setMenuOpen(false); act(admin?.session?.paused ? 'resume' : 'pause') }}>{admin?.session?.paused ? 'Resume Queue' : 'Pause New Entries'}</button>
          <button type="button" onClick={() => { setMenuOpen(false); setQrOpen(true) }}>Event QR Code</button>
          <button type="button" onClick={() => { setMenuOpen(false); setAddOpen(true) }}>+ Add Guest</button>
          <button type="button" onClick={() => { setMenuOpen(false); setResetOpen(true) }}>Reset Queue</button>
          <button type="button" onClick={async () => { await queueApi.logout(); setAuth(false) }}>Log out</button>
        </SettingsMenu>
      </header>

      {error && <p className="queue-error" role="alert">{error}</p>}

      <section className="queue-now-card">
        <p className="queue-kicker">Now serving</p>
        {serving ? (
          <>
            <p className="queue-now-initials">{serving.initials}</p>
            <p>#{serving.displayNumber}</p>
            <p className="queue-copy">{serving.name} · {serving.phoneMasked}</p>
            <p className="queue-copy">Started {serving.startedAgoMinutes} min ago</p>
            {serving.smsStatus && <p className="queue-copy">Last text: {serving.smsStatus.replaceAll('_', ' ')}</p>}
            {serving.smsError && (
              <>
                <p className="queue-sms-fail">{serving.smsError}</p>
                {serving.smsErrorKind && <button className="queue-secondary" type="button" disabled={busy === 'retrySms'} onClick={() => act('retrySms', { id: serving.id })}>{busy === 'retrySms' ? 'Retrying text…' : 'Retry text'}</button>}
              </>
            )}
            <button className="queue-done" type="button" disabled={busy === 'complete'} onClick={() => act('complete', { servingId: serving.id, busyKey: 'complete' })}>
              {busy === 'complete' ? 'Finishing…' : 'DONE'}
            </button>
          </>
        ) : (
          <>
            <p className="queue-copy">No one currently being served</p>
            {admin?.upNext?.length ? (
              <button className="queue-primary" type="button" disabled={busy === 'start'} onClick={() => act('start', { busyKey: 'start' })}>
                {busy === 'start' ? 'Starting…' : 'Start Serving'}
              </button>
            ) : (
              <div className="queue-empty">
                <p>Queue is empty</p>
                <p className="queue-copy">Guests can scan your event QR code to join.</p>
                <button className="queue-secondary" type="button" onClick={() => setQrOpen(true)}>Show QR Code</button>
              </div>
            )}
          </>
        )}
      </section>

      <section>
        <div className="queue-section-head">
          <h2>Up next</h2>
          <button className="queue-secondary" type="button" onClick={() => setAddOpen(true)}>+ Add Guest</button>
        </div>
        <ul className="queue-list">
          {(admin?.upNext || []).map((guest) => (
            <li key={guest.id}>
              <button className="queue-row" type="button" onClick={() => setOpenRow(openRow === guest.id ? null : guest.id)}>
                <strong>#{guest.displayNumber} {guest.initials}</strong>
                <span>{guest.waitLabel ? `~${guest.waitLabel}` : guest.status === 'next' ? 'Next' : ''}</span>
              </button>
              {openRow === guest.id && (
                <div className="queue-row-actions">
                  <p>{guest.name} · {guest.phoneMasked}</p>
                  {guest.smsStatus && <p className="queue-copy">Last text: {guest.smsStatus.replaceAll('_', ' ')}</p>}
                  {guest.smsError && (
                    <>
                      <p className="queue-sms-fail">{guest.smsError}</p>
                      {guest.smsErrorKind && <button type="button" disabled={busy === 'retrySms'} onClick={() => act('retrySms', { id: guest.id })}>{busy === 'retrySms' ? 'Retrying text…' : 'Retry text'}</button>}
                    </>
                  )}
                  <button type="button" onClick={() => (serving ? setServeConfirm(guest) : act('serveNow', { id: guest.id }))}>Serve Now</button>
                  <button type="button" onClick={() => act('move', { id: guest.id, direction: 'up' })}>Move Up</button>
                  <button type="button" onClick={() => act('move', { id: guest.id, direction: 'down' })}>Move Down</button>
                  <button type="button" onClick={() => act('skip', { id: guest.id })}>Skip</button>
                  <button type="button" onClick={() => act('remove', { id: guest.id })}>Remove</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <button className="queue-collapse" type="button" onClick={() => setSkippedOpen((value) => !value)}>
          Skipped ({stats?.skipped ?? 0})
        </button>
        {skippedOpen && (
          <ul className="queue-list">
            {(admin?.skipped || []).map((guest) => (
              <li key={guest.id} className="queue-row-static">
                <strong>{guest.initials} #{guest.displayNumber}</strong>
                <div className="queue-row-actions is-inline">
                  <button type="button" onClick={() => act('serveNow', { id: guest.id })}>Serve Next</button>
                  <button type="button" onClick={() => act('restore', { id: guest.id })}>Return to Queue</button>
                  <button type="button" onClick={() => act('remove', { id: guest.id })}>Remove</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="queue-stats">
        <p>Served today: {stats?.served ?? 0}</p>
        <p>Waiting: {stats?.waiting ?? 0}</p>
        <p>Skipped: {stats?.skipped ?? 0}</p>
        <p>Average service time: {stats?.averageServiceMinutes ?? 10} min</p>
      </section>

      {qrOpen && (
        <div className="queue-dialog-backdrop" role="dialog" aria-modal="true">
          <div className="queue-dialog queue-qr-dialog">
            <h2>Event QR Code</h2>
            <img className="queue-qr" src="/api/queue/qr" alt="Scan to join the henna queue" />
            <p>Scan to join the henna queue</p>
            <a className="queue-secondary" href="/api/queue/qr" download="ethnic-henna-queue.svg">Download</a>
            <button className="queue-secondary" type="button" onClick={() => setQrOpen(false)}>Close</button>
          </div>
        </div>
      )}

      {addOpen && (
        <div className="queue-dialog-backdrop" role="dialog" aria-modal="true">
          <form className="queue-dialog queue-form" onSubmit={async (event) => {
            event.preventDefault()
            if (await act('addGuest', { ...walkIn, busyKey: 'addGuest' })) setAddOpen(false)
          }}>
            <h2>Add guest</h2>
            <label htmlFor="walk-in-name">Name</label>
            <input id="walk-in-name" value={walkIn.name} onChange={(event) => setWalkIn({ ...walkIn, name: event.target.value })} required />
            <label htmlFor="walk-in-phone">Phone number</label>
            <input id="walk-in-phone" type="tel" value={walkIn.phone} onChange={(event) => setWalkIn({ ...walkIn, phone: event.target.value })} required />
            <label className="queue-consent">
              <input type="checkbox" checked={walkIn.consent} onChange={(event) => setWalkIn({ ...walkIn, consent: event.target.checked })} />
              <span>{SMS_CONSENT_LABEL}</span>
            </label>
            <div className="queue-dialog-actions">
              <button className="queue-secondary" type="button" onClick={() => setAddOpen(false)}>Cancel</button>
              <button className="queue-primary" type="submit" disabled={busy === 'addGuest'}>{busy === 'addGuest' ? 'Adding…' : 'Add to queue'}</button>
            </div>
          </form>
        </div>
      )}

      {resetOpen && (
        <div className="queue-dialog-backdrop" role="dialog" aria-modal="true">
          <div className="queue-dialog">
            <h2>Reset queue?</h2>
            <p>This will close the current event queue and remove all active guests from today’s line. Completed history will be preserved.</p>
            <div className="queue-dialog-actions">
              <button className="queue-secondary" type="button" onClick={() => setResetOpen(false)}>Cancel</button>
              <button className="queue-danger" type="button" onClick={() => { setResetOpen(false); act('reset') }}>Reset Queue</button>
            </div>
          </div>
        </div>
      )}

      {serveConfirm && (
        <div className="queue-dialog-backdrop" role="dialog" aria-modal="true">
          <div className="queue-dialog">
            <h2>Serve {serveConfirm.initials} now?</h2>
            <p>Someone is already being served. They’ll be moved back to the front of the waiting list.</p>
            <div className="queue-dialog-actions">
              <button className="queue-secondary" type="button" onClick={() => setServeConfirm(null)}>Cancel</button>
              <button className="queue-primary" type="button" onClick={() => act('serveNow', { id: serveConfirm.id })}>Serve Now</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

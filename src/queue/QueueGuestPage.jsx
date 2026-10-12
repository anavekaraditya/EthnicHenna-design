import React, { useEffect, useMemo, useState } from 'react'
import { queueApi } from './queueApi.js'
import { PushOptIn } from './PushOptIn.jsx'

const GUEST_SMS_CONSENT_LABEL = 'I agree to receive up to 3 queue texts for this visit. Msg & data rates may apply. Reply STOP to opt out. SMS consent is optional.'

function BrandMark() {
  return (
    <a className="queue-brand" href="/" aria-label="Ethnic Henna home">
      <img src="/brand/logo-mark.png" alt="" width="457" height="640" />
      <span>Ethnic Henna</span>
    </a>
  )
}

function statusLabel(guest) {
  if (!guest) return ''
  if (guest.status === 'serving') return 'Your turn'
  if (guest.status === 'next') return "You're next"
  if (guest.status === 'skipped') return 'Temporarily skipped'
  if (guest.status === 'completed') return 'All done'
  if (guest.status === 'removed') return 'You left the queue'
  if (guest.firstInLine) return "You're first in line"
  return "You're in line"
}

export function QueueGuestPage() {
  const [summary, setSummary] = useState(null)
  const [guest, setGuest] = useState(null)
  const [initialLoading, setInitialLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const [form, setForm] = useState({ name: '', phone: '' })
  const [smsConsent, setSmsConsent] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [stale, setStale] = useState(false)
  const [leaveOpen, setLeaveOpen] = useState(false)

  const loadSummary = async () => {
    try {
      const { data } = await queueApi.summary()
      setSummary(data)
    } catch {
      setStale(true)
    }
  }

  const loadGuest = async (token) => {
    if (!token) return
    try {
      const { data } = await queueApi.status(token)
      if (data.ok) {
        setGuest(data.guest)
        queueApi.saveToken(data.guest.token)
        setStale(false)
        setError('')
        return
      }
      if (data.error === 'invalid_token' || data.error === 'expired') {
        queueApi.clearToken()
        setGuest(null)
        setError(data.message || 'We couldn’t find your place in line.')
      }
    } catch {
      setStale(true)
    }
  }

  useEffect(() => {
    let cancelled = false
    async function initialize() {
      const token = queueApi.readToken()
      await Promise.all([loadSummary(), token ? loadGuest(token) : Promise.resolve()])
      if (!cancelled) setInitialLoading(false)
    }
    initialize()
    const timer = setInterval(() => {
      loadSummary()
      const current = queueApi.readToken()
      if (current) loadGuest(current)
    }, 15000)
    const onFocus = () => {
      loadSummary()
      const current = queueApi.readToken()
      if (current) loadGuest(current)
    }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)
    return () => {
      cancelled = true
      clearInterval(timer)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onFocus)
    }
  }, [])

  const headline = useMemo(() => statusLabel(guest), [guest])

  async function handleJoin(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const { data } = await queueApi.join({ ...form, consent: smsConsent })
      if (data.ok && data.guest) {
        setGuest(data.guest)
        setJoining(false)
        queueApi.saveToken(data.guest.token)
        if (data.alreadyQueued) setError("You're already in the queue.")
      } else {
        setError(data.message || 'Could not join the queue.')
      }
    } catch {
      setError('We couldn’t reach the queue. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function handleLeave() {
    const token = guest?.token || queueApi.readToken()
    if (!token) return
    setBusy(true)
    try {
      const { data } = await queueApi.leave(token)
      if (!data.ok) {
        setError(data.message || 'We couldn’t update your place in line. Please try again.')
        return
      }
      queueApi.clearToken()
      setGuest(null)
      setLeaveOpen(false)
      loadSummary()
    } catch {
      setError('We couldn’t update your place in line. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const paused = summary?.paused
  const closed = summary && summary.open === false

  return (
    <div className="queue-page queue-guest-page">
      <BrandMark />
      <main className="queue-main">
        {stale && (
          <p className="queue-banner" role="status">We couldn’t update your queue position. Trying again…</p>
        )}

        {initialLoading ? (
          <section className="queue-card queue-loading-card" aria-live="polite" aria-busy="true">
            <span className="queue-kicker">Event check-in</span>
            <div className="queue-skeleton queue-skeleton-title" />
            <div className="queue-skeleton queue-skeleton-copy" />
            <div className="queue-skeleton queue-skeleton-button" />
            <span className="visually-hidden">Loading your queue…</span>
          </section>
        ) : guest?.status === 'removed' ? (
          <section className="queue-card queue-state-card">
            <span className="queue-state-icon is-muted" aria-hidden="true">—</span>
            <p className="queue-kicker">Ticket closed</p>
            <h1>Your place was removed</h1>
            <p className="queue-lede">The artist removed this ticket from the queue. You can join again if check-in is still open.</p>
            <button className="queue-primary" type="button" disabled={closed || paused} onClick={() => {
              queueApi.clearToken()
              setGuest(null)
              setJoining(true)
              setError('')
            }}>{closed || paused ? 'Queue unavailable' : 'Join again'}</button>
          </section>
        ) : guest ? (
          <section className="queue-card queue-live-card" aria-live="polite">
            {guest.status === 'skipped' || guest.status === 'completed' ? (
              <>
                <span className={`queue-state-icon ${guest.status === 'completed' ? 'is-complete' : 'is-muted'}`} aria-hidden="true">{guest.status === 'completed' ? '✓' : '…'}</span>
                <p className="queue-kicker">{guest.status === 'completed' ? 'Session complete' : 'Please check in'}</p>
                <h1 className="queue-live-title">{headline}</h1>
                <p className="queue-copy">{guest.status === 'skipped'
                  ? 'Your spot has been temporarily skipped. Please check with the henna artist when you’re ready.'
                  : 'Thank you — your henna is complete.'}</p>
              </>
            ) : (
              <>
                <div className="queue-live-check" aria-hidden="true">
                  <svg viewBox="0 0 48 48" width="64" height="64">
                    <circle cx="24" cy="24" r="22" fill="none" stroke="currentColor" strokeWidth="3" />
                    <path d="M14 25.5 21 32.5 34 16.5" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <h1 className="queue-live-title">{guest.status === 'serving' ? "It's your turn" : "You're checked in!"}</h1>
                <p className="queue-live-place">{guest.status === 'serving' ? 'Please come to the henna station now.' : guest.status === 'next' ? 'Please stay nearby — you’re next.' : guest.liveLine?.placeLabel || headline}</p>
                <div className="queue-ticket-summary">
                  <span>Your ticket</span>
                  <strong>#{guest.queueNumber}</strong>
                  <small>{guest.status === 'serving' ? 'Please come to the station' : guest.waitLabel ? `Estimated wait · ${guest.waitLabel}` : guest.status === 'next' ? 'You’re up after the current guest' : 'You’re first in line'}</small>
                </div>
                {guest.liveLine?.rows?.length > 0 && (
                  <div className="queue-live-board">
                    <div className="queue-live-head">
                      <span>No.</span>
                      <span>Guest</span>
                      <span>At station</span>
                    </div>
                    <ol className="queue-live-list">
                      {guest.liveLine.rows.map((row) => (
                        <li className={row.isYou ? 'is-you' : ''} key={`${row.number}-${row.initials}`}>
                          <span className="queue-live-no">{row.number}.</span>
                          <span className="queue-live-guest" aria-label={row.isYou ? 'Your name' : `Guest ${row.number}, name partially hidden`}>
                            {row.isYou ? guest.name : row.displayName}
                          </span>
                          <span className="queue-live-mark">
                            {row.atStation ? (
                              <>
                                <svg viewBox="0 0 20 20" width="22" height="22" aria-hidden="true">
                                  <circle cx="10" cy="10" r="9" fill="none" stroke="currentColor" strokeWidth="1.8" />
                                  <path d="M5.5 10.5 8.5 13.5 14.5 6.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                                <span className="visually-hidden">At the henna station</span>
                              </>
                            ) : (
                              <span className="visually-hidden">{row.isYou ? 'Waiting' : 'Not at the station yet'}</span>
                            )}
                          </span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
                {guest.status !== 'serving' && (
                  <p className="queue-copy queue-live-note">Feel free to enjoy the event. Turn on browser alerts and we’ll let you know when your turn is close.</p>
                )}
              </>
            )}
            {['waiting', 'next', 'serving'].includes(guest.status) && <PushOptIn token={guest.token} />}
            {guest.status !== 'completed' && guest.status !== 'removed' && (
              <button className="queue-text-button" type="button" onClick={() => setLeaveOpen(true)}>Leave Queue</button>
            )}
          </section>
        ) : (
          <section className="queue-card queue-join-card">
            <p className="queue-kicker">Event check-in</p>
            <h1>Join the henna queue</h1>
            <p className="queue-lede">Check in with your name, then enjoy the event while you wait. We’ll keep your place updated here.</p>
            {closed ? (
              <p className="queue-banner" role="status">The henna queue isn’t open right now.</p>
            ) : paused ? (
              <p className="queue-banner" role="status">Queue temporarily paused. We’re catching up with everyone already waiting. Please check again shortly.</p>
            ) : (
              <div className="queue-summary-panel">
                <div><strong>{summary?.waitingCount ?? 0}</strong><span>{summary?.waitingCount === 1 ? 'guest waiting' : 'guests waiting'}</span></div>
                {summary?.waitLabel && <small>Estimated wait · {summary.waitLabel}</small>}
              </div>
            )}
            {!joining && !closed && !paused && (
              <button className="queue-primary" type="button" onClick={() => setJoining(true)}>Join the Queue</button>
            )}
            {joining && !closed && !paused && (
              <form className="queue-form" onSubmit={handleJoin}>
                <label htmlFor="queue-name">Your name</label>
                <input id="queue-name" name="name" autoComplete="name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required autoFocus />
                <label htmlFor="queue-phone">Phone number</label>
                <input id="queue-phone" name="phone" type="tel" autoComplete="tel" inputMode="tel" placeholder="(555) 555-0123" pattern="[+0-9(). -]{8,24}" title="Enter a valid phone number" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} required />
                <p className="queue-copy queue-push-note">Your number helps recover your ticket if you switch devices. We’ll only text you if you opt in below.</p>
                <label className="queue-consent queue-guest-consent">
                  <input type="checkbox" checked={smsConsent} onChange={(event) => setSmsConsent(event.target.checked)} />
                  <span>{GUEST_SMS_CONSENT_LABEL}</span>
                </label>
                <button className="queue-primary" type="submit" disabled={busy}>{busy ? 'Checking you in…' : 'Check in'}</button>
                <button className="queue-cancel-join" type="button" onClick={() => { setJoining(false); setError('') }}>Cancel</button>
              </form>
            )}
          </section>
        )}
        {error && <p className="queue-error" role="alert">{error}</p>}
      </main>
      {leaveOpen && (
        <div className="queue-dialog-backdrop" role="dialog" aria-modal="true" aria-labelledby="leave-title">
          <div className="queue-dialog">
            <h2 id="leave-title">Leave the queue?</h2>
            <p>You’ll lose your current place.</p>
            <div className="queue-dialog-actions">
              <button className="queue-secondary" type="button" onClick={() => setLeaveOpen(false)}>Cancel</button>
              <button className="queue-danger" type="button" onClick={handleLeave} disabled={busy}>Leave Queue</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

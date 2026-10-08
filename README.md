# Ethnic Henna Design

Vite + React marketing site for Ethnic Henna, deployed on Vercel.

The Vite app now serves queue APIs during `npm run dev`, so guests can join locally without a separate `vercel dev` process. Without Firebase credentials, local data is saved to `.queue-data.json` (gitignored). Production uses Cloud Firestore.

```bash
npm install
npm run dev
```

Local artist passcode is `henna-queue` unless `QUEUE_ADMIN_PASSWORD` is set.

Public pages: `/`, `/work`, `/designs`, `/bridal`, `/events`.

# Event Queue Setup

The live event queue is part of this same website. Guests open `/queue`. The artist operates `/queue/manage`. Queue data lives in Firebase Cloud Firestore. SMS is sent by Telnyx through Vercel serverless functions in `api/`. The browser never receives Firebase or Telnyx secrets.

## Architecture

- **Frontend:** existing Vite React SPA (`src/queue/*`)
- **API:** Vercel Node functions (`api/queue/*`)
- **Database:** Firebase Cloud Firestore (`queue_sessions`, `queue_entries`, `queue_meta`)
- **SMS:** Telnyx, called only from the API
- **Artist auth:** HTTP-only signed cookie after a server-side passcode check (`QUEUE_ADMIN_PASSWORD`)
- **Guest access:** unguessable `guest_token` stored in `localStorage` and the URL as `/queue?t=...`

## 1. Create a Firebase project

1. Create a project at [Firebase Console](https://console.firebase.google.com).
2. Enable **Cloud Firestore** (production mode).
3. Publish the rules in `firebase/firestore.rules` so the browser cannot read or write queue documents. The Vercel API uses the Admin SDK, which bypasses those rules.
4. Create a service account: Project settings → Service accounts → Generate new private key.
5. Copy `project_id`, `client_email`, and `private_key` into environment variables. Do not put them in any `VITE_` variable.

## 2. Firestore collections

No SQL migration is required. The API creates documents as needed:

- `queue_meta/current` — pointer to the active event session
- `queue_sessions/{id}` — open/paused state and average service minutes
- `queue_entries/{id}` — guests, order, SMS flags, guest tokens

Reset closes the current session and starts a new one. Historical entries stay on the old session.

## 3. Telnyx

The queue already sends through Telnyx (`api/_lib/sms.js`). You still need a Telnyx account and three values in `.env.local`.

1. Sign up at [Telnyx Mission Control](https://portal.telnyx.com/).
2. Add a card and a little balance under **Billing** (trial credit may not cover live US SMS).
3. **Numbers → Search & Buy** an SMS-capable US number. Copy it as E.164, like `+19255551234`.
4. **Messaging → Messaging Profiles → Add new profile** named `Ethnic Henna Queue`. Copy the profile ID.
5. **My Numbers** → assign that number to the profile.
6. **Keys & Credentials → API Keys** → create a **v2** key. Copy it once.
7. **Keys & Credentials → Public Key** → copy the webhook verification public key.
8. In **Messaging → Messaging Profiles → Ethnic Henna Queue**, set the inbound and status webhook URL to `https://YOUR_DOMAIN/api/queue/telnyx-webhook`.
9. For live US texts to guests, complete **10DLC**: Brand → Campaign (customer care / account notification) → assign the number to the approved campaign. Until that is approved, carriers often silently drop messages.
10. Put the values in `.env.local`:

```text
TELNYX_API_KEY=KEY...
TELNYX_PHONE_NUMBER=+1...
TELNYX_MESSAGING_PROFILE_ID=...
TELNYX_PUBLIC_KEY=...
SMS_ENABLED=true
```

9. Restart `npm run dev`. Join the queue with a name; phone number is optional.

Keep `SMS_ENABLED=false` until the three Telnyx values are filled in.

Transactional copy lives in `src/queue/smsCopy.js`.

## 4. Environment variables

Set these in `.env.local` for `vercel dev`, and in the Vercel project settings for production:

| Variable | Public? | Purpose |
|---|---|---|
| `FIREBASE_PROJECT_ID` | no | Firebase project ID |
| `FIREBASE_CLIENT_EMAIL` | no | Service account email |
| `FIREBASE_PRIVATE_KEY` | no | Service account private key (keep `\n` newlines) |
| `TELNYX_API_KEY` | no | Telnyx API v2 key |
| `TELNYX_PHONE_NUMBER` | no | From-number in E.164 |
| `TELNYX_MESSAGING_PROFILE_ID` | no | Optional messaging profile |
| `TELNYX_PUBLIC_KEY` | no | Telnyx Ed25519 webhook public key (base64 or PEM) |
| `VAPID_PUBLIC_KEY` | no | Public key used by browser push subscriptions |
| `VAPID_PRIVATE_KEY` | no | Private key used by the API to send browser push alerts |
| `VAPID_SUBJECT` | no | Contact URI such as `mailto:you@example.com` |
| `QUEUE_ADMIN_PASSWORD` | no | Artist passcode for `/queue/manage` |
| `SESSION_SECRET` | no | Signs the admin cookie (use a long random string) |
| `SITE_URL` | no | Canonical site origin used in SMS links |
| `SMS_ENABLED` | no | `true` only when real SMS should send |

See `.env.example`. Never prefix these secrets with `VITE_`.

## 5. Local development

```bash
npm run dev
```

`vite.config.js` includes the queue API during `npm run dev`.

Without Firebase env vars, local joins are stored in `.queue-data.json`. Add the Firebase variables to `.env.local` to persist in Firestore while developing.

## 6. Admin login

1. Open `/queue/manage`.
2. Enter `QUEUE_ADMIN_PASSWORD`.
3. The API sets an HTTP-only `eh_queue_admin` cookie (7 days, `SameSite=Lax`, `Secure` off localhost).
4. Log out from the dashboard menu.

Do not reuse the public `/admin` design-gallery password in client JavaScript for this queue.

## 7. SMS and browser notifications

Guests join with a name and do not need to provide a phone number. Their ticket link is saved in the current browser; they should keep the link to reopen the ticket or move to another device. There is no phone-based ticket recovery.

Guests can enable browser push on their ticket page and receive alerts when they are next and when their turn starts. On iPhone and iPad, they must add the queue page to the Home Screen, open it from that icon, and allow notifications. Other supported browsers need notification permission.

Generate a VAPID key pair with `npx web-push generate-vapid-keys`, then store the public and private keys as `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` in the local or Vercel environment. Set `VAPID_SUBJECT` to a contact address or HTTPS URL. Keep the private key out of the browser and source control. Browser push works independently of Telnyx.

`SMS_ENABLED=false` (the default) keeps SMS disabled. Browser push works without a phone number or Telnyx. To send real SMS to guests who provide a phone number and consent, set `SMS_ENABLED=true` after Telnyx is verified. The webhook verifies Telnyx signatures, records delivery status on each guest's latest text, disables future queue texts after STOP, and sends a HELP response. Telnyx webhook events are received at `/api/queue/telnyx-webhook`.

## 8. Production deployment

1. Push to GitHub (this app deploys from Vercel).
2. Add the environment variables above to the Vercel project.
3. Confirm Firestore is enabled and the deny-all rules are published.
4. Confirm `/queue` and `/queue/manage` rewrite to the SPA (see `vercel.json`).
5. Set `SITE_URL=https://ethnic-henna-design.vercel.app` (or your custom domain).
6. Set `SMS_ENABLED=true` when you want live texts.
7. Add VAPID keys if guests should receive browser alerts.

## 9. Reset behavior

**Reset Queue** marks the current `queue_sessions` row inactive and inserts a new active session. Previous tickets remain in `queue_entries` for history/stats of that session, but guests can no longer see them. Display numbers start at 1 again.

## 10. QR code usage

From `/queue/manage` → Menu → **Event QR Code**. The image is generated on the server and points at `{SITE_URL}/queue`. Show it full-screen on a phone/iPad or download the SVG for a printed sign.

## 11. Artist event checklist

1. Sign in at `/queue/manage`.
2. Reset the queue for a new event.
3. Show the QR code.
4. Tap **Start Serving** for the first guest. Do not expect the first joiner to get “it’s your turn” until you start.
5. Tap **DONE** after each guest. That completes them, promotes the next person, texts “it’s your turn”, and texts the following guest “you’re next”.
6. Use Skip for no-shows; restore them later from **Skipped**.

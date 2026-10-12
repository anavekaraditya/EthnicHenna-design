export const SMS_CONSENT_LABEL = 'I confirm the guest agreed to receive up to 3 Ethnic Henna queue texts for this visit. Msg & data rates may apply. Reply STOP to opt out. SMS is optional; no consent is needed to join.'

export function joinSms({ queueNumber, waitLabel, statusUrl }) {
  const wait = waitLabel ? ` with about ${waitLabel} to go` : ''
  return `Ethnic Henna: You're checked in at #${queueNumber}${wait}. Track your place: ${statusUrl}. Up to 3 queue texts per visit. Msg & data rates may apply. Reply HELP for help or STOP to opt out. SMS is optional; you can join without it.`
}

export function nextSms() {
  return "Ethnic Henna: You're next. Please make your way to the henna station. Reply STOP to opt out."
}

export function turnSms() {
  return "Ethnic Henna: It's your turn. Please come to the henna station now. Reply STOP to opt out."
}

export const SMS_HELP_MESSAGE = 'Ethnic Henna queue: For help, call (510) 340-8849 or visit https://ethnic-henna-design.vercel.app. Up to 3 queue texts per visit. Msg & data rates may apply. Reply STOP to opt out.'

export const SMS_STOP_CONFIRMATION = 'Ethnic Henna: You are unsubscribed and will receive no further queue texts.'

export function statusUrlForToken(siteUrl, token) {
  const origin = String(siteUrl || '').replace(/\/$/, '')
  return `${origin}/queue?t=${encodeURIComponent(token)}`
}

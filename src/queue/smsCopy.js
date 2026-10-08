export const SMS_CONSENT_LABEL = 'Optional: send me queue updates by text. Message and data rates may apply. Reply STOP to opt out.'

export function joinSms({ queueNumber, waitLabel, statusUrl }) {
  const wait = waitLabel ? ` with about ${waitLabel} to go` : ''
  return `Ethnic Henna: You're in the queue! You're currently #${queueNumber}${wait}. Track your place here: ${statusUrl}`
}

export function nextSms() {
  return "Ethnic Henna: You're next! Please start making your way back to the henna station. We'll text you again when it's your turn."
}

export function turnSms() {
  return "Ethnic Henna: It's your turn! Please come to the henna station now."
}

export function statusUrlForToken(siteUrl, token) {
  const origin = String(siteUrl || '').replace(/\/$/, '')
  return `${origin}/queue?t=${encodeURIComponent(token)}`
}

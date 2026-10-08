self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data?.text() || '' }
  }
  event.waitUntil(self.registration.showNotification(data.title || 'Queue update', {
    body: data.body || 'Your place in the henna queue has changed.',
    icon: '/brand/logo-mark.png',
    badge: '/brand/favicon.png',
    tag: data.tag || 'henna-queue-update',
    data: { url: data.url || '/queue' },
  }))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const destination = new URL(event.notification.data?.url || '/queue', self.location.origin).href
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
    const existing = clients.find((client) => new URL(client.url).origin === self.location.origin)
    if (existing) {
      existing.navigate(destination)
      return existing.focus()
    }
    return self.clients.openWindow(destination)
  }))
})

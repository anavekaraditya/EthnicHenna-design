import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { loadEnv } from 'vite'

const routeFiles = {
  '/api/queue/summary': 'api/queue/summary.js',
  '/api/queue/join': 'api/queue/join.js',
  '/api/queue/status': 'api/queue/status.js',
  '/api/queue/leave': 'api/queue/leave.js',
  '/api/queue/recover': 'api/queue/recover.js',
  '/api/queue/auth': 'api/queue/auth.js',
  '/api/queue/manage': 'api/queue/manage.js',
  '/api/queue/qr': 'api/queue/qr.js',
  '/api/queue/push': 'api/queue/push.js',
}

export function queueApiPlugin() {
  return {
    name: 'ethnic-henna-queue-api',
    async configureServer(server) {
      const env = loadEnv(server.config.mode, server.config.root, '')
      for (const [key, value] of Object.entries(env)) {
        if (process.env[key] === undefined) process.env[key] = value
      }
      if (!process.env.QUEUE_ADMIN_PASSWORD) process.env.QUEUE_ADMIN_PASSWORD = 'henna-queue'
      if (!process.env.SESSION_SECRET) process.env.SESSION_SECRET = 'ethnic-henna-local-session'
      if (process.env.SMS_ENABLED === undefined) process.env.SMS_ENABLED = 'false'

      const handlers = {}
      for (const [path, file] of Object.entries(routeFiles)) {
        handlers[path] = (await import(pathToFileURL(join(server.config.root, file)).href)).default
      }

      server.middlewares.use(async (req, res, next) => {
        const pathname = (req.url || '').split('?')[0]
        const handler = handlers[pathname]
        if (!handler) return next()
        try {
          await handler(req, res)
        } catch (error) {
          console.error('[queue-api]', error)
          if (!res.writableEnded) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json; charset=utf-8')
            res.end(JSON.stringify({
              ok: false,
              error: 'server_error',
              message: 'Something went wrong. Please try again.',
            }))
          }
        }
      })
    },
  }
}

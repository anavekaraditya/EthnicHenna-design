import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { queueApiPlugin } from './vite.queue-api.js'

export default defineConfig({
  base: '/',
  plugins: [react(), queueApiPlugin()],
})

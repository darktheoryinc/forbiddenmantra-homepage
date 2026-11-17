import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createApp, type ServerEnv } from './app'

// Minimal .env loader (no dependency). Real env vars win.
const envFile = resolve(process.cwd(), '.env')
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line)
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}

const app = createApp({ env: process.env as ServerEnv })
const dist = resolve(process.cwd(), 'dist')
if (existsSync(dist)) {
  app.use('/*', serveStatic({ root: './dist' }))
  app.get('*', serveStatic({ path: './dist/index.html' }))
}

const port = Number(process.env.API_PORT ?? process.env.PORT ?? 8787)
serve({ fetch: app.fetch, port }, (i) => console.log(`MyMindSet API listening on http://localhost:${i.port}`))

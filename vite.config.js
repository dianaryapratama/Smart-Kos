import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import mikrotikHandler from './api/mikrotik.js'

// Shim gaya Express (res.status/res.json) supaya handler serverless Vercel
// bisa jalan di middleware Node milik Vite saat development.
function applyExpressShim(res) {
  res.status = (code) => { res.statusCode = code; return res; }
  res.json = (body) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(JSON.stringify(body))
    return res
  }
  return res
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = ''
    req.on('data', (chunk) => { data += chunk })
    req.on('end', () => resolve(data))
    req.on('error', () => resolve(''))
  })
}

// Jalankan /api/mikrotik secara lokal tanpa perlu `vercel dev`
function mikrotikDevApi() {
  return {
    name: 'mikrotik-dev-api',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api/mikrotik', async (req, res) => {
        applyExpressShim(res)
        try {
          const url = new URL(req.url || '/', 'http://localhost')
          req.query = Object.fromEntries(url.searchParams.entries())
          if ((req.method || '').toUpperCase() === 'POST') {
            req.body = await readBody(req)
          }
          await mikrotikHandler(req, res)
        } catch (err) {
          res.status(500).json({ success: false, message: err?.message || 'Dev API error' })
        }
      })
    }
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Muat semua env (termasuk variabel non-VITE_) agar API dev bisa baca MIKROTIK_*
  const env = loadEnv(mode, process.cwd(), '')
  for (const [key, value] of Object.entries(env)) {
    if (key.startsWith('MIKROTIK_') && !process.env[key]) process.env[key] = value
  }

  return {
    plugins: [react(), mikrotikDevApi()],
    server: {
      allowedHosts: [
        'gunnar-athermanous-corrine.ngrok-free.dev'
      ]
    }
  }
})

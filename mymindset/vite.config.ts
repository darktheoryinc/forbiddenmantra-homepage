import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const apiPort = process.env.API_PORT ?? '8787'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'MyMindSet',
        short_name: 'MyMindSet',
        description: 'Capture ramblings, find the jokes, build and rehearse your set.',
        theme_color: '#14110f',
        background_color: '#14110f',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: { navigateFallbackDenylist: [/^\/api\//] },
    }),
  ],
  server: {
    host: true,
    port: 5173,
    proxy: { '/api': `http://localhost:${apiPort}` },
  },
  preview: { host: true, port: 4173, proxy: { '/api': `http://localhost:${apiPort}` } },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
})

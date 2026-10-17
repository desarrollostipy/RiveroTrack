import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['logo-rivero.png', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'Rivero Track & Field',
        short_name: 'Rivero',
        description: 'Planes, sesiones y cuotas de Rivero Track & Field',
        lang: 'es-PY',
        start_url: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#F4F6FA',
        theme_color: '#0B1B3A',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Las funciones de Netlify nunca se sirven desde la caché.
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],
})

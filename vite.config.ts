import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'Echo Music', short_name: 'Echo', description: 'Ad-free music, synced lyrics, your library.',
        start_url: '/', display: 'standalone', background_color: '#fef7ff', theme_color: '#ed5564',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        navigateFallbackDenylist: [/^\/api\//],            // never cache API / audio streams
        runtimeCaching: [{ urlPattern: ({ url }) => /fonts\.(googleapis|gstatic)\.com/.test(url.hostname), handler: 'CacheFirst', options: { cacheName: 'fonts' } },
        { urlPattern: ({ url }) => url.pathname === '/api/img',
          handler: 'CacheFirst', options: { cacheName: 'covers', expiration: { maxEntries: 300 } } }],
      },
    }),
  ],
  server: { proxy: { '/api': 'http://localhost:3001' } },
});

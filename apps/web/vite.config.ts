import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig(({ mode }) => {
  const isProduction = mode === 'production'
  
  const cspHeaders = {
    'Content-Security-Policy': [
      "default-src 'self'",
      isProduction ? "script-src 'self'" : "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "connect-src 'self'",
      "font-src 'self'",
      "object-src 'none'",
      "frame-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join('; '),
  }

  return {
    envDir: path.resolve(import.meta.dirname, '../..'),
    plugins: [tailwindcss(), react()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, './src'),
      },
    },
    server: {
      port: 5173,
      host: true,
      // Optional dev-only proxy: with VITE_DEV_API_PROXY set (for example
      // http://127.0.0.1:50286), /api calls stay same-origin, so local
      // development works against a running API without relaxing its CORS
      // allowlist or the dev CSP connect-src 'self'.
      proxy: process.env.VITE_DEV_API_PROXY
        ? {
            '/api': {
              target: process.env.VITE_DEV_API_PROXY,
              changeOrigin: true,
            },
          }
        : undefined,
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: undefined,
        },
      },
    },
    preview: {
      headers: cspHeaders,
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: [path.resolve(import.meta.dirname, 'src/setup-tests.ts')],
      server: {
        deps: {
          inline: ['@testing-library/react'],
        },
      },
    },
  }
})

import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueDevTools(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
  server: {
    proxy: {
      '/proxy/stage-f23': {
        target: 'http://smartcat-ai-agents-web.stage-feature-23.k9s.ya.sc.local',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy\/stage-f23/, ''),
      },
      '/proxy/stage-f4-gw': {
        target: 'http://platform-api-gateway-web.stage-feature-4.k8s.ya.sc.local',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy\/stage-f4-gw/, ''),
      },
      '/proxy/stage-f4': {
        target: 'http://smartcat-ai-agents-web.stage-feature-4.k9s.ya.sc.local',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy\/stage-f4/, ''),
      },
      '/proxy/local': {
        target: 'http://localhost:7601',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy\/local/, ''),
      },
    },
  },
})

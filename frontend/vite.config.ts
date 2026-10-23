import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // 開発中は /api へのリクエストをモックサーバーへ転送する (CORS 回避)
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
})

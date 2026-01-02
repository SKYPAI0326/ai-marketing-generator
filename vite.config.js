import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // 這裡設定為你的 GitHub Repository 名稱，通常與資料夾名稱一致
  base: '/ai-marketing-generator/',
})
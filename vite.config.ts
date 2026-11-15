import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// GitHub Pages 的项目站点挂在 https://<user>.github.io/mysql-visual/ 下，
// 构建时把资源前缀改成该子路径；本地 dev 仍用根路径，免得打开时被重定向。
const base = process.env.PAGES_BASE ?? '/mysql-visual/'

export default defineConfig(({ command }) => ({
  base: command === 'build' ? base : '/',
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
}))

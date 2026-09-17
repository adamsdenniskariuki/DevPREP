import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/DevPREP/',
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.replaceAll('\\', '/').includes('/src/content/')) return 'curriculum'
        },
      },
    },
  },
  test: { include: ['src/**/*.test.ts'] },
})

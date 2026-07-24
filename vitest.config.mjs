import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Next.js allows JSX inside plain `.js` files; teach the React plugin to
  // transform those too, otherwise esbuild chokes on the first `<` it sees.
  plugins: [react({ include: /\.jsx?$/ })],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    // Component tests are the common case. Pure Node modules opt out per file
    // with a `// @vitest-environment node` docblock.
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.js'],
    include: ['src/**/*.test.{js,jsx}', 'tests/**/*.test.{js,jsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{js,jsx}'],
      exclude: ['src/**/*.test.{js,jsx}', 'src/app/**/layout.js'],
    },
  },
})

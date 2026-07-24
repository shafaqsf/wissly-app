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
      // `import 'server-only'` is a build-time guard: under the `react-server`
      // condition it resolves to an empty module, everywhere else it throws on
      // import. Vitest is neither environment, so point it at the empty module
      // by hand — otherwise every server module under test explodes on line 1.
      'server-only': fileURLToPath(
        new URL('./node_modules/server-only/empty.js', import.meta.url),
      ),
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

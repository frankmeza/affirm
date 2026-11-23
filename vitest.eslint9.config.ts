import { defineConfig } from 'vitest/config'

// The plugin supports ESLint >= 9 (peer dependency). The main suite runs on the current ESLint;
// this config re-runs the rule tests against ESLint 9 by aliasing `eslint` to the `eslint-9` package.
export default defineConfig({
  resolve: { alias: { eslint: 'eslint-9' } },
  test: {
    include: ['test/runtime/eslint-*.test.ts'],
    env: { AFFIRM_EXPECT_ESLINT_MAJOR: '9' },
  },
})

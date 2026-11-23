import { defineConfig } from 'vitest/config'

export default defineConfig({
  build: {
    lib: {
      // `affirm` and the `affirm/eslint` plugin (design D8). They share no code.
      entry: { index: 'src/index.ts', eslint: 'src/eslint/index.ts' },
      formats: ['es'],
      fileName: (_format, name) => `${name}.js`,
    },
    target: 'es2023',
    minify: false,
    sourcemap: true,
  },
  test: {
    include: ['test/**/*.test.ts'],
    typecheck: {
      enabled: true,
      include: ['test/**/*.test-d.ts'],
      tsconfig: './tsconfig.json',
    },
  },
})

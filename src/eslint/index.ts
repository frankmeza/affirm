import type { ESLint, Linter } from 'eslint'
import { constParams } from './const-params.js'
import { guardNaming } from './guard-naming.js'
import { noNegatedAffirm } from './no-negated-affirm.js'

/**
 * ESLint plugin for projects that use `affirm` (flat config, ESLint 9+).
 *
 * @example
 * // eslint.config.js
 * import affirm from '@frankmeza/affirm/eslint'
 * export default [affirm.configs.recommended]
 *
 * // Optional: catch negated guards imported from other files, and/or a local re-export of affirm.
 * export default [
 *   affirm.configs.recommended,
 *   { settings: { affirm: { guards: '^isValid', sources: ['@frankmeza/affirm', '@/lib/affirm'] } } },
 * ]
 */
const plugin = {
  meta: { name: '@frankmeza/affirm/eslint' },
  rules: { 'no-negated-affirm': noNegatedAffirm, 'guard-naming': guardNaming, 'const-params': constParams },
  configs: {} as { recommended: Linter.Config },
} satisfies ESLint.Plugin

plugin.configs.recommended = {
  name: 'affirm/recommended',
  plugins: { affirm: plugin },
  // guard-naming does nothing until `settings.affirm.guards` is set; const-params only checks TypeScript files.
  rules: { 'affirm/no-negated-affirm': 'error', 'affirm/guard-naming': 'error', 'affirm/const-params': 'error' },
}

export default plugin

import type { ESLint, Linter } from 'eslint'
import { guardNaming } from './guard-naming'
import { noNegatedAffirm } from './no-negated-affirm'

/**
 * ESLint plugin for projects that use `affirm` (flat config, ESLint 9+).
 *
 * @example
 * // eslint.config.js
 * import affirm from 'affirm/eslint'
 * export default [affirm.configs.recommended]
 *
 * // Optional: catch negated guards imported from other files, and/or a local re-export of affirm.
 * export default [
 *   affirm.configs.recommended,
 *   { settings: { affirm: { guards: '^isValid', sources: ['affirm', '@/lib/affirm'] } } },
 * ]
 */
const plugin = {
  meta: { name: 'affirm/eslint' },
  rules: { 'no-negated-affirm': noNegatedAffirm, 'guard-naming': guardNaming },
  configs: {} as { recommended: Linter.Config },
} satisfies ESLint.Plugin

plugin.configs.recommended = {
  name: 'affirm/recommended',
  plugins: { affirm: plugin },
  // guard-naming does nothing until `settings.affirm.guards` is set.
  rules: { 'affirm/no-negated-affirm': 'error', 'affirm/guard-naming': 'error' },
}

export default plugin

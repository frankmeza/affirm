// Design D8, cross-file part: with `settings.affirm.guards`, a function returns affirm(…) if and only
// if its name matches the guard pattern, so `no-negated-affirm` can catch negated imported guards.
import { Linter, RuleTester } from 'eslint'
import { describe, expect, it, test } from 'vitest'
import plugin from '../../src/eslint'

RuleTester.describe = describe
RuleTester.it = it
RuleTester.itOnly = it.only

const rule = plugin.rules['guard-naming']
const tester = new RuleTester({ settings: { affirm: { guards: '^isValid' } } })

const IMPORT = "import { affirm } from 'affirm'\n"

tester.run('guard-naming', rule, {
  valid: [
    // guards named by the pattern, in every form
    `${IMPORT}export const isValidOrder = (v) => affirm(v, p)`,
    `${IMPORT}export function isValidOrder(v) { return affirm(v, p) }`,
    `${IMPORT}const isValidOrder = function (v) { return v != null && affirm(v, p) }`,
    `${IMPORT}const guards = { isValidOrder: (v) => affirm(v, p) }`,
    `${IMPORT}class Guards { isValidOrder(v) { return affirm(v, p) } }`,
    `${IMPORT}class Guards { isValidOrder = (v) => affirm(v, p) }`,
    // inline callbacks have no name to check
    `${IMPORT}rows.filter((r) => affirm(r, p))`,
    `${IMPORT}const valid = rows.filter(function (r) { return affirm(r, p) })`,
    // not a pure wrapper (more than a return), so not a guard; any name is fine
    `${IMPORT}function checkOrder(v) { log(v); return affirm(v, p) }`,
    // affirm() used in a function that returns something else
    `${IMPORT}function load(v) { return affirm(v, p) ? v : null }`,
    // non-matching names that don't return affirm
    'function isOrder(v) { return v != null }',
    // only the real affirm import counts
    'function affirm() { return true }\nconst isOrder = (v) => affirm(v)',
    // a local re-export, through settings.affirm.sources
    {
      code: "import { affirm } from '@/lib/affirm'\nconst isValidOrder = (v) => affirm(v, p)",
      settings: { affirm: { guards: '^isValid', sources: ['@/lib/affirm'] } },
    },
  ],
  invalid: [
    {
      code: `${IMPORT}export const isOrder = (v) => affirm(v, p)`,
      errors: [
        {
          message:
            'affirm: `isOrder` returns affirm(…), so its name must match the guard pattern `^isValid` (settings.affirm.guards). ' +
            'That lets affirm/no-negated-affirm catch `!isOrder(…)` in the files that import it.',
        },
      ],
    },
    { code: `${IMPORT}export function checkOrder(v) { return affirm(v, p) }`, errors: [{ messageId: 'unnamedGuard', data: { name: 'checkOrder', pattern: '^isValid' } }] },
    { code: `${IMPORT}const guards = { order: (v) => affirm(v, p) }`, errors: [{ messageId: 'unnamedGuard', data: { name: 'order', pattern: '^isValid' } }] },
    { code: `${IMPORT}class Guards { order(v) { return affirm(v, p) } }`, errors: [{ messageId: 'unnamedGuard' }] },
    {
      code: "import { affirm as check } from 'affirm'\nconst ok = (v) => check(v, p) && check(v, q)",
      errors: [{ messageId: 'unnamedGuard', data: { name: 'ok', pattern: '^isValid' } }], // one function, one report
    },
    // the pattern is reserved for guards
    {
      code: 'export function isValidEmail(s) { return s.includes("@") }',
      errors: [
        {
          message:
            'affirm: `isValidEmail` matches the guard pattern `^isValid` (settings.affirm.guards), which is reserved for functions whose whole body returns affirm(…). ' +
            'Rename it, or make it return affirm(…) (negating it is reported as negating a guard).',
        },
      ],
    },
    { code: `${IMPORT}function isValidOrder(v) { log(v); return affirm(v, p) }`, errors: [{ messageId: 'reservedName', data: { name: 'isValidOrder', pattern: '^isValid' } }] },
    { code: 'const isValidRow = (r) => r.ok', errors: [{ messageId: 'reservedName' }] },
  ],
})

// Without `settings.affirm.guards` the rule does nothing.
new RuleTester().run('guard-naming (no settings)', rule, {
  valid: [`${IMPORT}export const isOrder = (v) => affirm(v, p)`, 'export function isValidEmail(s) { return s.includes("@") }'],
  invalid: [],
})

test('a bad guard pattern is a configuration error, not a silent no-op', () => {
  const linter = new Linter()
  const lint = (guards: unknown) =>
    linter.verify('const x = 1', [{ plugins: { affirm: plugin }, rules: { 'affirm/guard-naming': 'error' }, settings: { affirm: { guards } } }])
  expect(() => lint('(')).toThrow(/`settings.affirm.guards` is not a valid regular expression/)
  expect(() => lint(42)).toThrow(/`settings.affirm.guards` must be a non-empty regular expression string/)
  expect(() => lint('^isValid')).not.toThrow()
})

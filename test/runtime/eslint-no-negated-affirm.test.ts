// Design D8: negating affirm() is banned in client code; `@frankmeza/affirm/eslint` enforces it.
import { RuleTester, type Linter } from 'eslint'
import tsParserModule from 'affirm-test-ts-parser' // typescript-eslint's parser, on TypeScript 5.9
import { describe, it } from 'vitest'
import plugin from '../../src/eslint'

RuleTester.describe = describe
RuleTester.it = it
RuleTester.itOnly = it.only

const rule = plugin.rules['no-negated-affirm']
const tester = new RuleTester()

const IMPORT = "import { affirm } from '@frankmeza/affirm'\n"

const ADVICE =
  'Negating affirm() is true when any check fails for any reason, so it tells you nothing reliable about the value. ' +
  'Use affirm.assert(value, params) to stop on bad data, affirm.explain(value, params) to handle failures by reason, ' +
  'or a positive check for the state you mean (e.g. `isNullish: true`).'

const negated = { messageId: 'negated' } as const

tester.run('no-negated-affirm', rule, {
  valid: [
    // positive uses
    `${IMPORT}if (affirm(x, { isPresent: true })) {}`,
    `${IMPORT}const y = affirm(x, p) ? a : b`,
    `${IMPORT}if (affirm(x, p)) {} else {}`, // decision (a): allowed, documented
    `${IMPORT}affirm(x, p) === true; affirm(x, p) !== false`,
    `${IMPORT}const ok = affirm(x, p); if (ok) {}`,
    `${IMPORT}items.filter((i) => affirm(i, p))`,
    // the recommended replacements
    `${IMPORT}const report = affirm.explain(x, p); if (!report.ok) {}`,
    `${IMPORT}affirm.assert(x, p)`,
    // decision (b): the \`not\` key is allowed
    `${IMPORT}if (affirm(x, { not: { isOneOf: ['admin', 'root'] } })) {}`,
    // not the affirm import
    'function affirm() { return true }\nif (!affirm(x)) {}',
    `${IMPORT}function f(affirm) { return !affirm(x) }`,
    "import { affirm } from 'other-lib'\n!affirm(x, p)",
    "import { assert } from '@frankmeza/affirm'\n!assert(x)",
    // stored results: only variables assigned once are tracked (a reassigned one may not hold affirm's result)
    `${IMPORT}let ok = affirm(x, p); ok = other(); if (!ok) {}`,
    `${IMPORT}const ok = affirm(x, p) ?? fallback; if (!ok) {}`,
    // wrappers: positive use is fine
    `${IMPORT}const isOrder = (v) => affirm(v, p); if (isOrder(x)) {} rows.filter(isOrder)`,
    `${IMPORT}function isOrder(v) { return affirm(v, p) } if (isOrder(x)) {}`,
    // not a pure wrapper (more than a single return), or reassigned: not tracked
    `${IMPORT}function isOrder(v) { log(v); return affirm(v, p) } if (!isOrder(x)) {}`,
    `${IMPORT}let isOrder = (v) => affirm(v, p); isOrder = other; if (!isOrder(x)) {}`,
    // a negated operand next to affirm() is not a negated affirm()
    `${IMPORT}if (!x && affirm(y, p)) {}`,
  ],

  invalid: [
    {
      code: `${IMPORT}function handle(body) {\n  if (!affirm(body, createUserParams)) return\n}`,
      errors: [{ message: `affirm: \`!affirm(body, createUserParams)\` is not allowed. ${ADVICE}` }],
    },
    { code: `${IMPORT}const bad = !(affirm(x, p))`, errors: [negated] },
    { code: `${IMPORT}const y = !!affirm(x, p)`, errors: [negated] },
    { code: `${IMPORT}if (affirm(x, p) === false) {}`, errors: [negated] },
    { code: `${IMPORT}if (false == affirm(x, p)) {}`, errors: [negated] },
    { code: `${IMPORT}if (affirm(x, p) !== true) {}`, errors: [negated] },
    { code: `${IMPORT}if (true != affirm(x, p)) {}`, errors: [negated] },
    { code: `${IMPORT}if (!affirm?.(x, p)) {}`, errors: [negated] },
    { code: `${IMPORT}if (!affirm(x, p) && y) {}`, errors: [negated] },
    { code: `${IMPORT}function f() { if (!affirm(x, p)) return null }`, errors: [negated] },
    {
      code: "import { affirm as check } from '@frankmeza/affirm'\nif (!check(x, p)) {}",
      errors: [{ messageId: 'negated', data: { usage: '!check(x, p)' } }],
    },
    { code: "import * as a from '@frankmeza/affirm'\nif (!a.affirm(x, p)) {}", errors: [negated] },
    { code: "import * as a from '@frankmeza/affirm'\nif (!a['affirm'](x, p)) {}", errors: [negated] },
    {
      code: "import { affirm } from '@/lib/affirm'\nif (!affirm(x, p)) {}",
      options: [{ sources: ['@frankmeza/affirm', '@/lib/affirm'] }],
      errors: [negated],
    },
    {
      code: `${IMPORT}const ok = affirm(user, { isPresent: true })\nif (!ok) {}\nif (ok === false) {}`,
      errors: [
        { messageId: 'negatedResult', data: { usage: '!ok', name: 'ok' } },
        { messageId: 'negatedResult', data: { usage: 'ok === false', name: 'ok' } },
      ],
    },
    // logical combinations: negating `a && affirm(…)` negates affirm(); reported once per negation
    { code: `${IMPORT}if (!(affirm(a, p) && affirm(b, q))) {}`, errors: [{ messageId: 'negated', data: { usage: '!(affirm(a, p) && affirm(b, q))' } }] },
    { code: `${IMPORT}if (!(x !== null && affirm(x, p))) {}`, errors: [negated] },
    { code: `${IMPORT}if ((affirm(x, p) || isAdmin) === false) {}`, errors: [negated] },
    // stored results: let / var assigned once, logical combinations
    {
      code: `${IMPORT}let ok = affirm(x, p)\nif (!ok) {}`,
      errors: [{ messageId: 'negatedResult', data: { usage: '!ok', name: 'ok' } }],
    },
    {
      code: `${IMPORT}const ok = affirm(a, p) && affirm(b, q)\nif (!ok) {}`,
      errors: [{ messageId: 'negatedResult', data: { usage: '!ok', name: 'ok' } }],
    },
    { code: `${IMPORT}const ok = affirm(x, p)\nif (!(ok && ready)) {}`, errors: [{ messageId: 'negatedResult' }] },
    // same-file wrappers
    {
      code: `${IMPORT}const isOrder = (v) => affirm(v, p)\nif (!isOrder(x)) {}`,
      errors: [{ messageId: 'negatedWrapper', data: { usage: '!isOrder(x)', name: 'isOrder' } }],
    },
    {
      code: `${IMPORT}const isOrder = (v) => { return affirm(v, p) }\nif (isOrder(x) === false) {}`,
      errors: [{ messageId: 'negatedWrapper', data: { usage: 'isOrder(x) === false', name: 'isOrder' } }],
    },
    {
      code: `${IMPORT}function isOrder(v) { return v != null && affirm(v, p) }\nif (!isOrder(x)) {}`,
      errors: [{ messageId: 'negatedWrapper', data: { usage: '!isOrder(x)', name: 'isOrder' } }],
    },
    {
      code: `${IMPORT}const isOrder = function (v) { return affirm(v, p) }\nexport function f(x) { return !isOrder(x) }`,
      errors: [{ messageId: 'negatedWrapper', data: { usage: '!isOrder(x)', name: 'isOrder' } }],
    },
    {
      // the message names the wrapper and carries the same advice
      code: `${IMPORT}const isOrder = (v) => affirm(v, p)\nif (!isOrder(order)) {}`,
      errors: [{ message: `affirm: \`!isOrder(order)\` negates \`isOrder\`, which returns affirm(…), which is not allowed. ${ADVICE}` }],
    },
    {
      // long usages are shortened to 60 characters
      code: `${IMPORT}if (!affirm(order, { shape: { total: { isType: 'number', isPositive: true } } })) {}`,
      errors: [{ messageId: 'negated', data: { usage: "!affirm(order, { shape: { total: { isType: 'number', isPosi…" } }],
    },
    // `if (!affirm(…)) throw …` offers `affirm.assert(…)` as a suggestion (never an autofix)
    {
      code: `${IMPORT}if (!affirm(body, params)) throw new Error('bad body')`,
      errors: [
        {
          messageId: 'negated',
          suggestions: [
            {
              messageId: 'suggestAssert',
              data: { replacement: "affirm.assert(body, params, 'bad body')" },
              output: `${IMPORT}affirm.assert(body, params, 'bad body')`,
            },
          ],
        },
      ],
    },
    {
      code: `${IMPORT}if (!affirm(body, params)) {\n  throw new TypeError(\`bad body\`)\n}`,
      errors: [
        {
          messageId: 'negated',
          suggestions: [
            {
              messageId: 'suggestAssert',
              data: { replacement: 'affirm.assert(body, params, `bad body`)' },
              output: `${IMPORT}affirm.assert(body, params, \`bad body\`)`,
            },
          ],
        },
      ],
    },
    {
      code: `${IMPORT}if (!affirm(body, params)) throw makeError(body)`,
      errors: [
        {
          messageId: 'negated',
          suggestions: [
            {
              messageId: 'suggestAssert',
              data: { replacement: 'affirm.assert(body, params)' },
              output: `${IMPORT}affirm.assert(body, params)`,
            },
          ],
        },
      ],
    },
    {
      code: "import { affirm as check } from '@frankmeza/affirm'\nif (!check(body, params)) throw new Error('bad')",
      errors: [
        {
          messageId: 'negated',
          suggestions: [
            {
              messageId: 'suggestAssert',
              data: { replacement: "check.assert(body, params, 'bad')" },
              output: "import { affirm as check } from '@frankmeza/affirm'\ncheck.assert(body, params, 'bad')",
            },
          ],
        },
      ],
    },
  ],
})

// Cross-file guards (design D8): with `settings.affirm.guards`, a negated call to any function whose
// name matches the pattern is reported, wherever it comes from. `guard-naming` keeps the names honest.
const GUARDS = { affirm: { guards: '^isValid' } }

tester.run('no-negated-affirm (settings.affirm.guards)', rule, {
  valid: [
    { code: "import { isValidOrder } from './guards'\nif (isValidOrder(x)) {}", settings: GUARDS },
    { code: "import { isValidOrder } from './guards'\nrows.filter(isValidOrder)", settings: GUARDS },
    // without the setting, an imported guard is invisible (the documented convention applies)
    "import { isValidOrder } from './guards'\nif (!isValidOrder(x)) {}",
    // names that don't match the pattern
    { code: "import { isOrder } from './guards'\nif (!isOrder(x)) {}", settings: GUARDS },
    { code: 'if (!guards[name](x)) {}', settings: GUARDS },
    // third-party functions that happen to match the pattern are not the project's guards
    { code: "import validator from 'validator'\nif (!validator.isValidPhoneNumber(x)) {}", settings: GUARDS },
    { code: "import { isValidUrl } from 'url-kit'\nif (!isValidUrl(x)) {}", settings: GUARDS },
    { code: "import * as kit from '@scope/kit'\nif (!kit.isValidUrl(x)) {}", settings: GUARDS },
    { code: 'if (!isValidThing(x)) {}', settings: GUARDS }, // an undeclared global
    // a path alias is treated like a package until it is listed in guardModules
    { code: "import { isValidOrder } from '@/guards'\nif (!isValidOrder(x)) {}", settings: GUARDS },
  ],
  invalid: [
    {
      code: "import { isValidOrder } from './guards'\nfunction handle(body) {\n  if (!isValidOrder(body)) return\n}",
      settings: GUARDS,
      errors: [
        {
          message:
            "affirm: `!isValidOrder(body)` negates `isValidOrder`, a guard built on affirm() (its name matches the guard pattern `^isValid`), which is not allowed. " +
            ADVICE,
        },
      ],
    },
    {
      code: "import * as guards from './guards'\nif (guards.isValidOrder(x) === false) {}",
      settings: GUARDS,
      errors: [{ messageId: 'negatedGuard', data: { usage: 'guards.isValidOrder(x) === false', name: 'isValidOrder', pattern: '^isValid' } }],
    },
    {
      code: "import { isValidOrder } from './guards'\nif (!(isValidOrder(a) && isValidOrder(b))) {}",
      settings: GUARDS,
      errors: [{ messageId: 'negatedGuard' }], // one problem per negation
    },
    // project code: path aliases listed in guardModules, local definitions, methods on local values
    {
      code: "import { isValidOrder } from '@/guards'\nif (!isValidOrder(x)) {}",
      settings: { affirm: { guards: '^isValid', guardModules: ['@/'] } },
      errors: [{ messageId: 'negatedGuard', data: { usage: '!isValidOrder(x)', name: 'isValidOrder', pattern: '^isValid' } }],
    },
    { code: "import * as g from '../shared/guards'\nif (!g.isValidOrder(x)) {}", settings: GUARDS, errors: [{ messageId: 'negatedGuard' }] },
    { code: 'const isValidRow = (r) => r.ok\nif (!isValidRow(x)) {}', settings: GUARDS, errors: [{ messageId: 'negatedGuard' }] },
    { code: 'class C { m(x) { return !this.isValidOrder(x) } }', settings: GUARDS, errors: [{ messageId: 'negatedGuard' }] },
    {
      code: "import { isValidOrder } from './guards'\nconst ok = !isValidOrder(x)",
      settings: GUARDS,
      errors: [{ messageId: 'negatedGuard' }],
    },
  ],
})

// The same rule on TypeScript-only syntax, parsed the way TypeScript clients lint (typescript-eslint).
// Type assertions and non-null assertions sit between `!` and the call without changing the value.
const tsTester = new RuleTester({ languageOptions: { parser: tsParserModule as unknown as Linter.Parser } })

tsTester.run('no-negated-affirm (TypeScript syntax)', rule, {
  valid: [
    `${IMPORT}if (affirm(x, p) as boolean) {}`,
    `${IMPORT}const isOrder = (v: unknown): v is Order => affirm(v, p)\nif (isOrder(x)) {}`,
    `import type { AffirmParams } from '@frankmeza/affirm'\nconst p: AffirmParams = { isPresent: true }\nif (!check(x, p)) {}`,
  ],
  invalid: [
    { code: `${IMPORT}if (!affirm(x, p)) {}`, errors: [negated] },
    { code: `${IMPORT}if (!(affirm(x, p) as boolean)) {}`, errors: [{ messageId: 'negated', data: { usage: '!(affirm(x, p) as boolean)' } }] },
    { code: `${IMPORT}if (!(affirm(x, p) satisfies boolean)) {}`, errors: [negated] },
    { code: `${IMPORT}if (!affirm(x, p)!) {}`, errors: [negated] },
    { code: `${IMPORT}if (!(<boolean>affirm(x, p))) {}`, errors: [negated] },
    { code: `${IMPORT}if ((affirm(x, p) as boolean) === false) {}`, errors: [negated] },
    { code: `${IMPORT}const ok: boolean = affirm(x, p)\nif (!ok) {}`, errors: [{ messageId: 'negatedResult' }] },
    {
      code: `${IMPORT}const isOrder = (v: unknown): v is Order => affirm(v, p)\nif (!isOrder(x)) {}`,
      errors: [{ messageId: 'negatedWrapper', data: { usage: '!isOrder(x)', name: 'isOrder' } }],
    },
    {
      code: `${IMPORT}function isOrder(v: unknown): v is Order { return affirm(v, p) }\nif (!isOrder(x)) {}`,
      errors: [{ messageId: 'negatedWrapper' }],
    },
    {
      code: `${IMPORT}if (!affirm(body, p as AffirmParams)) throw new Error('bad')`,
      errors: [
        {
          messageId: 'negated',
          suggestions: [
            {
              messageId: 'suggestAssert',
              data: { replacement: "affirm.assert(body, p as AffirmParams, 'bad')" },
              output: `${IMPORT}affirm.assert(body, p as AffirmParams, 'bad')`,
            },
          ],
        },
      ],
    },
  ],
})

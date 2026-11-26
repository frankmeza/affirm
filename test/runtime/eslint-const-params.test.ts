// Hoisted params lose their literal types unless declared `as const` (docs/client-usage.md §8.1).
import { RuleTester, type Linter } from 'eslint'
import tsParserModule from '../fixtures/ts-parser/index.cjs' // typescript-eslint's parser, on TypeScript 5.9
import { describe, it } from 'vitest'
import plugin from '../../src/eslint'

RuleTester.describe = describe
RuleTester.it = it
RuleTester.itOnly = it.only

const rule = plugin.rules['const-params']
const tester = new RuleTester({ languageOptions: { parser: tsParserModule as unknown as Linter.Parser } })

const IMPORT = "import { affirm } from '@frankmeza/affirm'\n"
const ts = <T extends object>(cases: T[]) => cases.map((c) => ({ filename: 'file.ts', ...c }))

const needsConst = (name: string) =>
  `affirm: params \`${name}\` need \`as const\`. Without it TypeScript widens their values ('a' → string, true → boolean) ` +
  `before affirm() sees them, so narrowing is silently lost. Declare \`const ${name} = { … } as const\`.`

tester.run('const-params', rule, {
  valid: ts([
    // inline params keep their literals through affirm's `const` type parameter
    { code: `${IMPORT}affirm(x, { isOneOf: ['a', 'b'] })` },
    // hoisted with `as const`, optionally checked with `satisfies`
    { code: `${IMPORT}const p = { isOneOf: ['a', 'b'] } as const\naffirm(x, p)` },
    { code: `${IMPORT}const p = { isType: 'string' } as const satisfies AffirmParams\naffirm.assert(x, p)` },
    { code: `${IMPORT}const roles = ['a', 'b'] as const\naffirm(x, { isOneOf: roles })` },
    // values that aren't literals: `as const` wouldn't change anything
    { code: `${IMPORT}const p = loadParams()\naffirm(x, p)` },
    { code: `${IMPORT}function f(p: AffirmParams) { return affirm(x, p) }` },
    { code: `${IMPORT}let p = { isPresent: true }\naffirm(x, p)` }, // only const declarations are checked
    // not affirm (bare lists are only found through affirm calls)
    { code: "const roles = ['a']\ncheck(x, { isOneOf: roles })" },
    { code: "import { affirm } from 'other'\nconst roles = ['a']\naffirm(x, { isOneOf: roles })" },
    // recognised by keys: already `as const`
    { code: "export const orderParams = { isPlainObject: true, shape: { id: { isType: 'string' } } } as const" },
    { code: "export const p = { isPresent: true } as const satisfies AffirmParams" },
    // look-alikes: generic words only, unknown keys, or nothing distinctive nested inside
    { code: "export const manifest = { matches: ['<all_urls>'] }" },
    { code: "export const circle = { shape: 'circle' }" },
    { code: "export const schema = { anyOf: [{ type: 'string' }], not: { type: 'null' } }" },
    { code: 'export const config = { port: 8080, isProduction: true }' },
    { code: "export const rule = { is: 'admin', includes: ['a'] }" },
    { code: 'export const merged = { ...base }' },
    { code: 'export let p = { isPresent: true }' },
    { code: 'export const p = { isPresent: true }', filename: 'file.js' },
    // documented gap: a bare list can't be recognised by its keys
    { code: "export const ROLES = ['admin', 'member']" },
    // JavaScript files are skipped: `as const` is TypeScript syntax
    { code: `${IMPORT}const p = { isOneOf: ['a', 'b'] }\naffirm(x, p)`, filename: 'file.js' },
  ]),

  invalid: ts([
    {
      code: `${IMPORT}const q = { isOneOf: ['a', 'b'] }\naffirm(x, q)`,
      output: `${IMPORT}const q = { isOneOf: ['a', 'b'] } as const\naffirm(x, q)`,
      errors: [{ message: needsConst('q') }],
    },
    // assert and explain take params too
    {
      code: `${IMPORT}const p = { isPresent: true }\naffirm.assert(x, p)`,
      output: `${IMPORT}const p = { isPresent: true } as const\naffirm.assert(x, p)`,
      errors: [{ messageId: 'needsConst' }],
    },
    {
      code: `${IMPORT}const p = { isBetween: [1, 5] }\nconst r = affirm.explain(x, p)`,
      output: `${IMPORT}const p = { isBetween: [1, 5] } as const\nconst r = affirm.explain(x, p)`,
      errors: [{ messageId: 'needsConst' }],
    },
    // `satisfies` without `as const`: insert before `satisfies`
    {
      code: `${IMPORT}const p = { isType: 'string' } satisfies AffirmParams\naffirm(x, p)`,
      output: `${IMPORT}const p = { isType: 'string' } as const satisfies AffirmParams\naffirm(x, p)`,
      errors: [{ messageId: 'needsConst' }],
    },
    // hoisted pieces inside params: arrays, nested params, spreads, and inside other hoisted params
    {
      code: `${IMPORT}const roles = ['admin', 'member']\naffirm(x, { isOneOf: roles })`,
      output: `${IMPORT}const roles = ['admin', 'member'] as const\naffirm(x, { isOneOf: roles })`,
      errors: [{ messageId: 'needsConst', data: { name: 'roles' } }],
    },
    {
      code: `${IMPORT}const idParams = { isType: 'string' }\nconst order = { shape: { id: idParams } } as const\naffirm(x, order)`,
      output: `${IMPORT}const idParams = { isType: 'string' } as const\nconst order = { shape: { id: idParams } } as const\naffirm(x, order)`,
      errors: [{ messageId: 'needsConst', data: { name: 'idParams' } }],
    },
    {
      code: `${IMPORT}const base = { isPresent: true }\naffirm(x, { ...base, isType: 'string' })`,
      output: `${IMPORT}const base = { isPresent: true } as const\naffirm(x, { ...base, isType: 'string' })`,
      errors: [{ messageId: 'needsConst', data: { name: 'base' } }],
    },
    // reported once per declaration, however often it's used; `typeof p` in a type is still "only params"
    {
      code: `${IMPORT}const p = { isOneOf: ['a'] }\naffirm(x, p)\naffirm(y, p)\ntype T = Affirmed<unknown, typeof p>`,
      output: `${IMPORT}const p = { isOneOf: ['a'] } as const\naffirm(x, p)\naffirm(y, p)\ntype T = Affirmed<unknown, typeof p>`,
      errors: [{ messageId: 'needsConst' }],
    },
    // used outside params too: `as const` could break that use, so it's a suggestion, not an autofix
    {
      code: `${IMPORT}const roles = ['a', 'b']\nroles.push('c')\naffirm(x, { isOneOf: roles })`,
      output: null,
      errors: [
        {
          messageId: 'needsConst',
          suggestions: [
            {
              messageId: 'suggestConst',
              data: { name: 'roles' },
              output: `${IMPORT}const roles = ['a', 'b'] as const\nroles.push('c')\naffirm(x, { isOneOf: roles })`,
            },
          ],
        },
      ],
    },
    // a type annotation or cast erases the literals: suggest `as const satisfies T`
    {
      code: `${IMPORT}const p: AffirmParams = { isOneOf: ['a', 'b'] }\naffirm(x, p)`,
      output: null,
      errors: [
        {
          message:
            'affirm: params `p` are typed as `AffirmParams`, which erases their exact values, so affirm() can only narrow ' +
            'with the general type. Use `as const satisfies AffirmParams` instead: it keeps both the type check and the exact values.',
          suggestions: [
            {
              messageId: 'suggestTyped',
              data: { type: 'AffirmParams' },
              output: `${IMPORT}const p = { isOneOf: ['a', 'b'] } as const satisfies AffirmParams\naffirm(x, p)`,
            },
          ],
        },
      ],
    },
    {
      code: `${IMPORT}const p = { isOneOf: ['a', 'b'] } as AffirmParams\naffirm(x, p)`,
      output: null,
      errors: [
        {
          messageId: 'typed',
          suggestions: [
            {
              messageId: 'suggestTyped',
              data: { type: 'AffirmParams' },
              output: `${IMPORT}const p = { isOneOf: ['a', 'b'] } as const satisfies AffirmParams\naffirm(x, p)`,
            },
          ],
        },
      ],
    },
    // recognised by keys, wherever they are declared: covers params exported to other files
    {
      code: "export const orderParams = { isPlainObject: true, shape: { id: { isType: 'string' } } }",
      output: "export const orderParams = { isPlainObject: true, shape: { id: { isType: 'string' } } } as const",
      errors: [{ message: needsConst('orderParams') }],
    },
    {
      code: "export const p = { shape: { id: { isType: 'string' } } }", // generic outer key, distinctive nested params
      output: "export const p = { shape: { id: { isType: 'string' } } } as const",
      errors: [{ messageId: 'needsConst' }],
    },
    {
      code: "export const p = { anyOf: [{ isNull: true }, { isType: 'string' }] }",
      output: "export const p = { anyOf: [{ isNull: true }, { isType: 'string' }] } as const",
      errors: [{ messageId: 'needsConst' }],
    },
    {
      code: "export const p = { 'isOneOf': ['a', 'b'] }",
      output: "export const p = { 'isOneOf': ['a', 'b'] } as const",
      errors: [{ messageId: 'needsConst' }],
    },
    {
      code: 'export const p = { isPresent: true } satisfies AffirmParams',
      output: 'export const p = { isPresent: true } as const satisfies AffirmParams',
      errors: [{ messageId: 'needsConst' }],
    },
    {
      code: 'export const p: AffirmParams = { isPresent: true }',
      output: null,
      errors: [{ messageId: 'typed', suggestions: [{ messageId: 'suggestTyped', output: 'export const p = { isPresent: true } as const satisfies AffirmParams' }] }],
    },
    {
      // used in this file other than as params: a suggestion, not an autofix
      code: 'const p = { isPresent: true }\nregister(p)',
      output: null,
      errors: [{ messageId: 'needsConst', suggestions: [{ messageId: 'suggestConst', output: 'const p = { isPresent: true } as const\nregister(p)' }] }],
    },
    {
      // pieces of recognised params are followed too, so the bare list inside is caught here
      code: "const ROLES = ['admin', 'member']\nexport const roleParams = { isOneOf: ROLES } as const",
      output: "const ROLES = ['admin', 'member'] as const\nexport const roleParams = { isOneOf: ROLES } as const",
      errors: [{ messageId: 'needsConst', data: { name: 'ROLES' } }],
    },
    // aliased and namespace imports
    {
      code: "import { affirm as check } from '@frankmeza/affirm'\nconst p = { isPresent: true }\ncheck(x, p)",
      output: "import { affirm as check } from '@frankmeza/affirm'\nconst p = { isPresent: true } as const\ncheck(x, p)",
      errors: [{ messageId: 'needsConst' }],
    },
    {
      code: "import * as a from '@frankmeza/affirm'\nconst p = { isPresent: true }\na.affirm.assert(x, p)",
      output: "import * as a from '@frankmeza/affirm'\nconst p = { isPresent: true } as const\na.affirm.assert(x, p)",
      errors: [{ messageId: 'needsConst' }],
    },
  ]),
})

// Type-aware: with typescript-eslint's type information, names imported from other files are followed
// to their declarations (test/fixtures/typed-project/roles.ts). This is what catches bare lists.
const CWD = (globalThis as unknown as { process: { cwd(): string } }).process.cwd() // vitest runs from the project root
const PROJECT = `${CWD}/test/fixtures/typed-project`
const typedTester = new RuleTester({
  languageOptions: {
    parser: tsParserModule as unknown as Linter.Parser,
    parserOptions: {
      project: './tsconfig.json',
      tsconfigRootDir: PROJECT,
      // With CI=true, typescript-eslint infers a single run and builds the program once from the files
      // on disk. RuleTester lints its own code under file.ts, whose on-disk content is only a
      // placeholder, so the program never sees the imports and every type-aware case reports nothing.
      disallowAutomaticSingleRunInference: true,
    },
  },
})
const inProject = <T extends object>(cases: T[]) => cases.map((c) => ({ filename: `${PROJECT}/file.ts`, ...c }))

const importedWidened = (name: string, reason: string, line: number) =>
  `affirm: \`${name}\` is used in params here, but it is declared ${reason} in test/fixtures/typed-project/roles.ts:${line}, ` +
  "so TypeScript widened its values ('a' → string) before affirm() sees them, and narrowing is silently lost. Fix that declaration: `= … as const`."

typedTester.run('const-params (type-aware)', rule, {
  valid: inProject([
    { code: `${IMPORT}import { CONST_ROLES } from './roles'\naffirm(x, { isOneOf: CONST_ROLES })` },
    // a dynamic list: nothing literal to fix
    { code: `${IMPORT}import { LOADED_ROLES } from './roles'\naffirm(x, { isOneOf: LOADED_ROLES })` },
    // \`let\` is out of scope (only const declarations are checked)
    { code: `${IMPORT}import { LET_ROLES } from './roles'\naffirm(x, { isOneOf: LET_ROLES })` },
    // a property of a widened object: not followed
    { code: `${IMPORT}import { config } from './roles'\naffirm(x, { isOneOf: config.roles })` },
    // imported, but not used in params
    { code: `${IMPORT}import { ROLES } from './roles'\nconsole.log(ROLES)` },
  ]),
  invalid: inProject([
    {
      code: `${IMPORT}import { ROLES } from './roles'\naffirm(user.role, { isOneOf: ROLES })`,
      errors: [{ message: importedWidened('ROLES', 'without `as const`', 5) }],
    },
    {
      code: `${IMPORT}import { TYPED_ROLES } from './roles'\naffirm.assert(x, { containsAll: TYPED_ROLES })`,
      errors: [{ messageId: 'importedWidened', data: { name: 'TYPED_ROLES', reason: 'with the type `string[]`', file: 'test/fixtures/typed-project/roles.ts', line: '7' } }],
    },
    // through a re-export, and through a namespace import
    { code: `${IMPORT}import { RE_ROLES } from './reexport'\naffirm(x, { isOneOf: RE_ROLES })`, errors: [{ messageId: 'importedWidened' }] },
    { code: `${IMPORT}import * as R from './roles'\naffirm(x, { isOneOf: R.ROLES })`, errors: [{ messageId: 'importedWidened', data: { name: 'ROLES', reason: 'without `as const`', file: 'test/fixtures/typed-project/roles.ts', line: '5' } }] },
    // one report per declaration per file
    { code: `${IMPORT}import { ROLES } from './roles'\naffirm(x, { isOneOf: ROLES })\naffirm(y, { containsAny: ROLES })`, errors: [{ messageId: 'importedWidened' }] },
  ]),
})

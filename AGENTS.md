# affirm: usage guide for coding agents

`affirm(value, params)` replaces compound data checks with one object of named checks. It returns a boolean and narrows `value`'s type.

```ts
// instead of
if (order && typeof order === 'object' && 'total' in order && typeof order.total === 'number' && order.total > 0) { … }

// write
if (affirm(order, { hasKey: 'total', shape: { total: { isType: 'number', isPositive: true } } })) {
  order.total // number
}
```

Every key has hover docs with its exact pass condition and an example. When unsure what a key does, read its JSDoc in `AffirmParams`.

For more detail, including scenario recipes, report formats, a narrowing table and pitfalls that compile but are wrong, see [`docs/client-usage.md`](docs/client-usage.md).

## API

```ts
import { affirm, AffirmError } from 'affirm'

affirm(value, params)                   // boolean; narrows `value` in the if-branch
affirm.explain(value, params)           // { ok, failures }: every failure, with paths
affirm.assert(value, params, message?)  // throws AffirmError on failure; narrows afterwards
```

Requires TypeScript 5.9 or later. On older versions, narrowing silently breaks: every `else` branch becomes `never`.

Lint client code with the bundled plugin. It enforces Rule 10, which TypeScript can't check:

```js
// eslint.config.js
import affirm from 'affirm/eslint'
export default [affirm.configs.recommended, { settings: { affirm: { guards: '^isValid' } } }]
```

`guards` is a naming contract: functions that just return `affirm(…)` must be named by it, and nothing else may be. That lets the rule catch `!isValidOrder(x)` even when the guard is imported. Functions imported from packages never count. If you import your own code through a path alias, add it: `guardModules: ['@/']`.

## Rules

1. **Value first, params second.** `affirm(value, { … })`, never `affirm({ value, … })`.
2. **Keys combine with AND.** For OR, use `anyOf: [{ … }, { … }]`.
3. **An omitted or `undefined` key is skipped.** You can build params conditionally: `{ hasMinLength: strict ? 8 : undefined }`.
4. **Boolean keys: `true` asserts, `false` asserts the negation.** `isNull: false` means "is not null".
5. **No coercion.** `isGreaterThan: 5` fails on `'10'`; `hasMinLength: 3` fails on a number.
6. **The wrong kind of value fails both polarities.** `isPositive: false` means "a number that is not positive", so it fails on `'x'`. The same goes for `isInteger`, `isBlank`, `isEmpty`, `isValidDate`, ….
7. **Data failures return `false`; mistakes throw `TypeError`.** These throw: unknown keys (with a "did you mean" hint), empty params `{}`, wrong param types (`matches: 'abc'`), and async schemas. Don't wrap `affirm` in try/catch to handle bad data.
8. **Equality is `===`.** `isOneOf` and `contains*` use SameValueZero (`NaN` matches `NaN`). Use `isDeepEqual` for structure.
9. **Own keys only.** `hasKey`, `hasPath`, `shape` and friends use `Object.hasOwn`. For prototype getters or class instances, use `satisfies`.
10. **Never negate `affirm()`.** `!affirm(…)`, `affirm(…) === false`, a negated variable holding its result (`!ok`), and a negated same-file wrapper (`!isOrder(x)`) are lint errors (`affirm/no-negated-affirm`). With `settings.affirm.guards`, negated guards imported from other files are lint errors too. Name every guard built on `affirm` by that pattern. `affirm` is an AND of narrow checks, so its negation means "something failed, for some reason", which is too broad to build on. Instead: `affirm.assert` to stop on bad data, `affirm.explain` (`if (!report.ok)`) to handle failures by reason, or a positive check for the state you mean (`if (affirm(x, { isNull: true })) return`). The `not:` key is fine: it negates one named sub-check.

## Keys at a glance

| Group | Keys |
| --- | --- |
| Equality | `is`, `isNot`, `isOneOf`, `isNotOneOf`, `isDeepEqual` |
| Nullish | `isNull`, `isUndefined`, `isNullish`, `isDefined` (≠ undefined), `isPresent` (≠ null and ≠ undefined), `isTruthy`, `isFalsy` |
| Runtime type | `isType` (`'string'`, `'number'`, `'boolean'`, `'bigint'`, `'symbol'`, `'function'`, `'object'`, a type guard, or a sync Standard Schema), `isArray`, `isPlainObject`, `isFunction`, `isInstanceOf`, `isValidDate`, `isInteger`, `isFiniteNumber`, `isNaN` |
| Size (strings, arrays, Maps, Sets) | `isEmpty`, `isNotEmpty` (also plain objects), `isBlank`, `hasLength`, `hasMinLength`, `hasMaxLength` |
| Numbers | `isGreaterThan`, `isAtLeast` (≥), `isLessThan`, `isAtMost` (≤), `isBetween: [min, max]` (**inclusive**), `isPositive`, `isNegative`, `isMultipleOf` |
| Strings | `startsWith`, `endsWith`, `includes` (strings only), `matches: RegExp` |
| Objects | `shape: { field: params }`, `hasKey`, `hasKeys`, `hasAnyKey`, `hasOnlyKeys`, `hasPath: 'a.b.0.c'` |
| Arrays | `contains` (arrays only), `containsAll`, `containsAny`, `everyItem: params`, `someItem: params` |
| Composition | `not: params`, `anyOf: [params, …]`, `satisfies: (v) => boolean` (runs last) |

Naming: `is*` describes state, `has*` describes possession, and `contains*` / `matches` / `startsWith` / … describe a search.

## Recipes

```ts
// Present, non-empty string
affirm(name, { isType: 'string', isBlank: false })

// Null or empty (isEmpty fails on null by itself)
affirm(input, { anyOf: [{ isNullish: true }, { isEmpty: true }] })

// Nullable field inside an object
affirm(user, { shape: { middleName: { anyOf: [{ isNull: true }, { isType: 'string' }] } } })

// Optional field: missing fields are checked as undefined
affirm(user, { shape: { nickname: { anyOf: [{ isUndefined: true }, { isType: 'string' }] } } })

// Enum
affirm(status, { isOneOf: ['draft', 'published', 'archived'] })

// Array of objects
affirm(order.items, {
  isNotEmpty: true,
  everyItem: { shape: { sku: { isBlank: false }, qty: { isInteger: true, isAtLeast: 1 } } },
})

// Exact keys only
affirm(query, { isPlainObject: true, hasOnlyKeys: ['page', 'limit'] })

// Cross-field rule: `satisfies` receives `unknown`, so guard first
affirm(range, { satisfies: (r) => isRange(r) && r.min <= r.max })

// An existing Zod / Valibot / ArkType schema (sync only; validates, never transforms)
affirm(body, { isType: OrderSchema })

// Config at startup: throw with a clear message
affirm.assert(env.PORT, { isType: 'string', matches: /^\d+$/ }, 'PORT must be numeric')

// Explain why a request body failed (safe to log: no raw values)
const report = affirm.explain(body, { shape: { email: { matches: /@/ } } })
if (!report.ok) return badRequest(report.failures.map((f) => f.reason))
// e.g. "items[2].id: expected length >= 3, received string(len 2)"
```

## Type narrowing

- **Exact checks** narrow both branches. These are `isNull`, `isUndefined`, `isNullish`, `isDefined`, `isPresent`, `isType` with a primitive tag or guard, `isArray: true`, `isFunction: true`, `is`/`isOneOf` with literals, and `anyOf` of exact branches. Example: with `x: string | null`, after `if (affirm(x, { isNull: true })) return`, `x` is `string`.
- **Refined checks** (all others) narrow only the `if` branch. The type gets a phantom `& Refined` marker, which you can ignore: a `string & Refined` works anywhere a `string` does. The `else` branch keeps the full type, because a value can fail for other reasons.
- **No narrowing at all** happens for refined checks whose result could be `null` or `undefined` (e.g. `isFalsy` on `string | null`). TypeScript can't express that soundly, so `affirm` returns a plain boolean. If you need narrowing, split the check: `affirm(x, { isPresent: true }) && affirm(x, { … })`.
- **Contradictions are compile errors**, e.g. "`isNull: true` contradicts `isPresent: true`" or "`hasMinLength: 10` is greater than `hasMaxLength: 9`". So are unknown keys at any depth.
- Name a narrowed type with `Affirmed<Input, Params>`.

## Don't

- **Don't store params in a variable without `as const`.** `const p = { isOneOf: ['a', 'b'] }` is widened to `string[]` before `affirm` sees it, so it narrows to `string`, not `'a' | 'b'`. Write `const p = { … } as const` (or `as const satisfies AffirmParams`), never `const p: AffirmParams = …`. `affirm/const-params` flags this, including params exported from other files (recognised by their keys), and `eslint --fix` adds `as const`. Write lists used in params (`isOneOf: ROLES`) `as const` too; with type-aware linting (`projectService`), imported lists that aren't are reported at the use.
- **Don't negate `affirm()`** (Rule 10). No `if (!affirm(…)) return` guard clauses: use `affirm.assert`, `explain`, or put the main path in the positive branch.
- **Don't use `affirm` to parse or transform** (coercion, defaults, trimming). Use a schema library, then `affirm` its result or pass the schema as `isType`.
- **Don't write `isType: 'null'` or `isType: 'undefined'`** (they throw). Use `isNull` / `isUndefined`.
- **Don't pass a class to `isType`.** Use `isInstanceOf`.
- **Don't use `includes` on arrays or `contains` on strings.** They fail. `includes` is for substrings, `contains` is for array items.
- **Don't pass a string to `matches`.** It needs a `RegExp`; use `includes` for plain text.
- **Don't use `{}` as params**, or `shape: {}` / `anyOf: []`. They throw (they would always pass).
- **Don't put secrets in params expecting them to stay out of logs.** Reports never include checked values, but short param literals do appear in `expected` (e.g. `=== "admin"`).

# Using `affirm` in a client project

This guide shows how to use `affirm` in application code that depends on it, such as API handlers, config loading, fetch responses, form input and array filtering. It is written for AI coding agents that generate that code, and for the people who review it.

[`AGENTS.md`](../AGENTS.md) is the short reference. This document goes deeper into the parts of the API that generated code uses most, and into the mistakes that compile but do the wrong thing. Every behaviour and error message quoted here was checked against the current source (TypeScript 7.0, `strict: true`).

---

## 1. Setup

The package is ESM-only and is not published. Build it, then depend on it locally:

```sh
# in the affirm repo
pnpm build
```

```jsonc
// client package.json
"dependencies": {
  "affirm": "link:../affirm"
}
```

```ts
import { affirm, AffirmError, type AffirmParams, type Affirmed, type AffirmReport, type AffirmFailure } from 'affirm'
```

`affirm` has no runtime dependencies. For narrowing to work, the client's `tsconfig.json` needs `"strict": true`, or at least `strictNullChecks`.

**Requirements: TypeScript 5.9 or later** (declared as an optional peer dependency, so package managers warn about older versions). This is not cosmetic. On 5.8 and earlier, `affirm`'s types fail to resolve, and with the usual `skipLibCheck: true` nothing reports it. Narrowing then goes silently wrong: the `if` branch narrows nothing, and every `else` branch becomes `never`, so code that runs on real data type-checks as unreachable.

### ESLint plugin (required)

`affirm/eslint` enforces the one usage rule that TypeScript can't check: **never negate `affirm()`** (§9). Add it to the client's flat config (ESLint 9+):

```js
// eslint.config.js
import affirm from 'affirm/eslint'

export default [
  // …your other configs, including the TypeScript parser for .ts files
  affirm.configs.recommended, // 'affirm/no-negated-affirm': 'error'
]
```

The rule only flags calls to the real `affirm` import, including aliased (`import { affirm as check }`) and namespace (`ns.affirm(…)`) imports.

Both rules read one shared settings block. Setting `guards` is **strongly recommended**: without it, negated guards imported from other files can't be caught (§9).

```js
export default [
  affirm.configs.recommended,
  {
    settings: {
      affirm: {
        guards: '^isValid',                 // the naming pattern for guards built on affirm (a regex string)
        guardModules: ['@/'],               // only if you import your own code through path aliases
        sources: ['affirm', '@/lib/affirm'], // only if your project re-exports affirm from its own module
      },
    },
  },
]
```

`affirm.configs.recommended` turns on three rules:

| Rule | What it enforces |
| --- | --- |
| `affirm/no-negated-affirm` | No negated `affirm()`, directly or through variables, `&&` / `\|\|`, same-file wrappers, or (with `guards`) any call whose name matches the guard pattern |
| `affirm/guard-naming` | With `guards` set: every named function whose whole body returns `affirm(…)` matches the pattern, and only such functions do. Does nothing without `guards` |
| `affirm/const-params` | TypeScript files: params declared apart from the call are `as const`, so they keep their exact values (§8.1). Autofixable |

The rules need no type information. `eslint` is an optional peer dependency, so projects that don't lint don't install it.

---

## 2. Which entry point to use

| Situation | Use | Returns |
| --- | --- | --- |
| Branch on data that passes (`if`, `filter`, ternaries) | `affirm(value, params)` | `boolean`; narrows `value` in the `if` branch. **Never negated** (§9) |
| Data must be valid or the program can't go on (config, invariants, trusted internal data) | `affirm.assert(value, params, message?)` | `void`; throws `AffirmError`; narrows `value` for the rest of the scope |
| You need to tell someone *why* it failed (400 responses, form errors, logs) | `affirm.explain(value, params)` | `{ ok, failures }`; never throws on bad data |

Rules of thumb:

- **Default to `affirm()`.** It stops at the first failure, so it is the cheapest.
- **Use `explain()` only where the failure details are used.** It runs every check and collects every failure.
- **Use `assert()` where a failure is a bug or a fatal misconfiguration**, not where bad input is expected. Don't wrap `assert` in `try/catch` to get a boolean. Use `affirm()` instead.
- **Handle the failure path with `explain()` or `assert()`, never with `!affirm()`** (§9).

`explain` does not narrow. To get both the report and narrowing, call `explain`, handle `!report.ok`, then call `affirm.assert` (see §5.1). It can't fail at that point, and it narrows the rest of the scope. Alternatively, catch `AffirmError` from `assert` (see §6.3).

---

## 3. The rules that decide whether generated code is correct

Read these before writing any params. Most bugs in generated `affirm` code break one of them.

1. **Value first, params second.** `affirm(value, { … })`, never `affirm({ value, … })`.
2. **Keys combine with AND.** The only OR is `anyOf: [{ … }, { … }]`.
3. **An omitted key, or one set to `undefined`, is skipped.** This allows conditional params: `{ hasMinLength: strict ? 8 : undefined }`.
4. **`true` asserts, `false` asserts the negation.** `isNull: false` means "not null". It never means "don't check".
5. **No coercion.** `'10'` fails `isGreaterThan: 5`. `42` fails `hasMinLength: 1`. Parse first, then check.
6. **The wrong kind of value fails both polarities.** `isPositive: false` means "a number that is not positive", so `'x'` fails it. The same goes for `isInteger`, `isFiniteNumber`, `isNaN`, `isBlank`, `isEmpty`, `isNotEmpty` and `isValidDate`. To say "not a positive number, or not a number at all", use `not: { isPositive: true }`.
7. **Bad data returns `false`; mistakes in params throw `TypeError`.** Params are validated on every call, before any check runs, so a typo throws even when the value would have failed earlier. Never catch these errors. Fix the params.
8. **Own keys only.** `shape`, `hasKey`, `hasKeys`, `hasAnyKey`, `hasOnlyKeys` and `hasPath` use `Object.hasOwn`. Getters on a class prototype are invisible to them, so use `satisfies` or `isInstanceOf` for class instances.
9. **Evaluation order is fixed, not object-key order.** Type and nullish checks run first, then size, number and string checks, then structural checks (`shape`, `everyItem`, `isDeepEqual`, …), and `satisfies` runs last. You don't need to order keys defensively, and a `satisfies` predicate only runs after every other key has passed (under `affirm()`; under `explain()` it always runs).
10. **Never negate `affirm()`.** `!affirm(…)`, `affirm(…) === false`, a negated variable holding its result, and a negated same-file wrapper (`!isOrder(x)`) are lint errors. Don't negate imported guards built on `affirm` either. The negation means "some check failed, for some reason", which is too broad to build on. Use `assert`, `explain`, or a positive check for the state you mean (§9).

---

## 4. The keys generated code uses most

### 4.1 Presence and nullish

```ts
affirm(x, { isPresent: true })    // x !== null && x !== undefined
affirm(x, { isDefined: true })    // x !== undefined (null passes!)
affirm(x, { isNullish: true })    // x === null || x === undefined
affirm(x, { isNull: false })      // x !== null (undefined passes)
```

- **`isPresent` is almost always what you want** for "has a value". `isDefined` lets `null` through.
- `isTruthy` / `isFalsy` treat `0`, `''` and `NaN` as falsy. Don't use them for "has a value" on numbers or strings that may legitimately be `0` or `''`.
- These keys are **exact**, so they narrow both branches (see §7).

### 4.2 Runtime type

```ts
affirm(x, { isType: 'string' })       // typeof x === 'string'
affirm(x, { isType: 'number' })       // typeof; NaN and Infinity pass! Add isFiniteNumber
affirm(x, { isType: 'object' })       // non-null object, ARRAYS INCLUDED
affirm(x, { isPlainObject: true })    // {} literal / JSON object / Object.create(null); not arrays, not class instances
affirm(x, { isArray: true })
affirm(x, { isInstanceOf: URL })      // classes go here, never in isType
affirm(x, { isValidDate: true })      // a Date whose getTime() is not NaN
affirm(x, { isInteger: true })        // Number.isInteger (implies number)
affirm(x, { isFiniteNumber: true })   // Number.isFinite (implies number)
```

- `isType` accepts exactly `'string' | 'number' | 'boolean' | 'bigint' | 'symbol' | 'function' | 'object'`, a type guard, or a **synchronous** Standard Schema (Zod, Valibot, ArkType).
- `isType: 'null'` and `isType: 'undefined'` throw: use `isNull` / `isUndefined`. `isType: SomeClass` throws: use `isInstanceOf`.
- To accept "a JSON object", write `isPlainObject: true`, not `isType: 'object'`, which also accepts arrays, `Date`s and `Map`s.
- To accept "a real number", write `isFiniteNumber: true`. It already implies `number`.

### 4.3 Strings

```ts
affirm(name, { isType: 'string', isBlank: false })                 // the "required text field" idiom
affirm(slug, { matches: /^[a-z0-9-]+$/, hasMaxLength: 64 })
affirm(url,  { startsWith: 'https://' })
affirm(text, { includes: 'TODO' })                                 // substring, strings only
```

- `isBlank: true` means the string is empty or whitespace only. `isBlank: false` means "a string with at least one non-whitespace character". It fails on non-strings, so it already implies `isType: 'string'`. Writing both is still clearer for readers and costs nothing.
- `matches` requires a `RegExp`. A string param throws. `lastIndex` is reset before each test, so `/g` regexes are safe to reuse.
- `hasLength` / `hasMinLength` / `hasMaxLength` count UTF-16 code units (`.length`), not characters or bytes.
- Anchor your regexes (`^…$`). `matches: /\d+/` passes on `'abc1'`.

### 4.4 Numbers

```ts
affirm(qty,   { isInteger: true, isAtLeast: 1 })
affirm(price, { isFiniteNumber: true, isAtLeast: 0 })
affirm(port,  { isInteger: true, isBetween: [1, 65535] })   // inclusive on both ends
affirm(pct,   { isGreaterThan: 0, isLessThan: 100 })        // exclusive bounds
affirm(cents, { isMultipleOf: 5 })
```

- Every number key fails on `NaN` and on non-numbers, including numeric strings.
- `isBetween` is **inclusive**. For exclusive bounds, combine `isGreaterThan` and `isLessThan`.
- `isPositive` means `> 0`. Zero is not positive. For "zero or more", use `isAtLeast: 0`.
- `bigint` is not supported by the number keys.

### 4.5 Equality and enums

```ts
affirm(status, { isOneOf: ['draft', 'published', 'archived'] })
affirm(role,   { is: 'admin' })
affirm(role,   { isNotOneOf: ['root', 'system'] })
affirm(config, { isDeepEqual: { mode: 'strict', retries: 3 } })
```

- `is` uses `===`, and `isOneOf` uses SameValueZero (`NaN` matches `NaN`). Objects compare by reference. Use `isDeepEqual` to compare structure.
- With literal params written inline, `isOneOf` narrows to the literal union (`'draft' | 'published' | 'archived'`). If you hoist the list into a variable, add `as const` or the narrowing widens to `string` (§8.1).

### 4.6 Objects: `shape` is the workhorse

`shape` checks named fields, each with its own params. This is how most generated code validates objects.

```ts
const ok = affirm(body, {
  isPlainObject: true,
  shape: {
    email: { isType: 'string', matches: /^[^@\s]+@[^@\s]+$/ },
    age: { isInteger: true, isBetween: [13, 130] },
    role: { isOneOf: ['admin', 'member'] },
  },
})
```

What `shape` does:

- **A missing field is checked as `undefined`.** So `shape: { email: { isType: 'string' } }` already requires `email` to be present. You don't need `hasKey: 'email'` as well.
- **It only checks the fields you list.** Extra fields pass. To reject unknown fields, add `hasOnlyKeys: [...]`.
- **It accepts arrays as well as objects**, and fails on `null` / primitives with a single failure (`expected an object or array, received null`). Add `isPlainObject: true` when arrays must be rejected.
- **Fields nest without limit**: `shape: { user: { shape: { address: { shape: { zip: {...} } } } } }`.

Optional and nullable fields:

```ts
shape: {
  // optional: may be missing / undefined
  nickname: { anyOf: [{ isUndefined: true }, { isType: 'string', hasMaxLength: 20 }] },
  // nullable: present but may be null
  middleName: { anyOf: [{ isNull: true }, { isType: 'string' }] },
  // optional AND nullable
  bio: { anyOf: [{ isNullish: true }, { isType: 'string' }] },
}
```

Do not write `nickname: { isType: 'string' }` for an optional field. A missing field is `undefined`, so the check fails.

Other object keys:

```ts
affirm(x, { hasKey: 'id' })                       // own key exists (value may be undefined)
affirm(x, { hasKeys: ['id', 'name'] })            // all of them
affirm(x, { hasAnyKey: ['email', 'phone'] })      // at least one
affirm(x, { hasOnlyKeys: ['page', 'limit'] })     // no others (does NOT require these to be present)
affirm(x, { hasPath: 'user.address.zip' })        // every segment exists; numeric segments index arrays: 'items.0.id'
affirm(x, { isNotEmpty: true })                   // a plain object with ≥ 1 own enumerable key
```

Prefer `shape` over `hasKey` / `hasPath` when you also care about the field's value. `hasKey: 'x'` passes when `x` is present but `undefined`.

### 4.7 Arrays: `everyItem` and friends

```ts
affirm(order.items, {
  isNotEmpty: true,          // everyItem alone passes on []
  everyItem: {
    shape: {
      sku: { isType: 'string', isBlank: false },
      qty: { isInteger: true, isAtLeast: 1 },
    },
  },
})

affirm(tags,  { isArray: true, hasMaxLength: 10, everyItem: { isType: 'string' } })
affirm(roles, { contains: 'admin' })                    // one item, SameValueZero
affirm(roles, { containsAll: ['read', 'write'] })
affirm(roles, { containsAny: ['admin', 'owner'] })
affirm(users, { someItem: { shape: { isOwner: { is: true } } } })   // false on []
```

- **`everyItem` passes on an empty array.** Add `isNotEmpty: true` (or `hasMinLength: 1`) when at least one item is required.
- **`contains*` are for arrays and `includes` is for strings.** Using the wrong one fails rather than throwing, which makes it a silent bug. Watch for it.
- `contains` compares with SameValueZero, so `contains: { id: 1 }` never matches a different object. Use `someItem: { isDeepEqual: { id: 1 } }` or `someItem: { shape: { id: { is: 1 } } }`.
- Failure paths include the index: `items[1].qty`.

### 4.8 Composition: `anyOf`, `not`, `satisfies`

```ts
// OR
affirm(id, { anyOf: [{ isType: 'string', isBlank: false }, { isInteger: true, isAtLeast: 1 }] })

// NOT. The nested keys AND together first: not (a AND b)
affirm(username, { not: { isOneOf: ['admin', 'root'] } })

// Cross-field rules. The predicate receives `unknown`, so guard inside it
const rangeFields = { shape: { min: { isFiniteNumber: true }, max: { isFiniteNumber: true } } } as const
affirm(range, {
  ...rangeFields,
  satisfies: (r: unknown) => affirm(r, rangeFields) && r.min <= r.max, // annotate `r`: see §8.2
})
```

- `satisfies` runs last. Under `affirm()`, it only runs once every other key in the same params has passed. Under `affirm.explain()`, every key runs, including `satisfies` on malformed input. Always guard inside the predicate rather than casting: a cast like `(r as Range).min` throws on `null` under `explain()`.
- The predicate must return exactly `true`. Truthy values such as `1` or `'yes'` fail.
- Errors thrown inside `satisfies` propagate to the caller. They are not turned into failures.
- `anyOf: []`, `shape: {}` and `{}` throw because they would always pass.

### 4.9 Existing schemas (Zod / Valibot / ArkType)

```ts
import { z } from 'zod'
const Order = z.object({ id: z.string(), total: z.number().positive() })

if (affirm(body, { isType: Order })) {
  body.total // number
}
```

- **Sync schemas only.** A schema whose `validate` returns a Promise (`z.string().refine(async …)`) throws `TypeError`.
- **Validation only, no transformation.** `affirm` never returns the parsed value, so `.transform()`, `.default()` and coercion have no effect. Narrowing uses the schema's *input* type. If you need the transformed output, call `Order.parse(body)` yourself.
- Schema issue messages are **not** copied into reports, because they can contain raw values. Each issue becomes a failure at the issue's path, with `expected: 'a value accepted by the zod schema'`.

---

## 5. Recipes by client-code scenario

### 5.1 HTTP handler: validate a request body and return 400 with reasons

```ts
import { affirm } from 'affirm'

const createUserParams = {
  isPlainObject: true,
  hasOnlyKeys: ['email', 'name', 'age', 'role'],
  shape: {
    email: { isType: 'string', matches: /^[^@\s]+@[^@\s]+$/, hasMaxLength: 254 },
    name: { isType: 'string', isBlank: false, hasMaxLength: 100 },
    age: { anyOf: [{ isUndefined: true }, { isInteger: true, isBetween: [13, 130] }] },
    role: { isOneOf: ['admin', 'member'] },
  },
} as const

export async function createUser(req: Request): Promise<Response> {
  const body: unknown = await req.json()

  const report = affirm.explain(body, createUserParams)
  if (!report.ok) {
    return Response.json({ errors: report.failures.map((f) => ({ field: f.path, message: f.reason })) }, { status: 400 })
  }

  // explain() does not narrow. assert() can't fail here, and narrows `body` from now on.
  affirm.assert(body, createUserParams)

  return Response.json(await db.users.insert({ email: body.email, name: body.name, role: body.role }))
}
```

### 5.2 Startup config: fail fast with `assert`

```ts
import { affirm } from 'affirm'

affirm.assert(process.env.DATABASE_URL, { isType: 'string', startsWith: 'postgres://' }, 'DATABASE_URL must be a postgres:// URL')
affirm.assert(process.env.PORT, { isType: 'string', matches: /^\d{2,5}$/ }, 'PORT must be numeric')

const port = Number(process.env.PORT)
affirm.assert(port, { isInteger: true, isBetween: [1, 65535] }, 'PORT out of range')

// Both env vars are narrowed to `string` from here on.
```

Note the order: env vars are strings, so check the string, convert it, then check the number. Rule 5 applies: `isBetween` on the raw `'8080'` fails.

### 5.3 Fetch response from a third-party API

```ts
const orderPayload = {
  isPlainObject: true,
  shape: {
    id: { isType: 'string' },
    status: { isOneOf: ['pending', 'shipped', 'delivered'] },
    items: { isArray: true, everyItem: { shape: { sku: { isType: 'string' }, qty: { isInteger: true } } } },
  },
} as const

async function fetchOrder(id: string) {
  const res = await fetch(`https://api.example.com/orders/${id}`)
  const data: unknown = await res.json()

  if (affirm(data, orderPayload)) {
    data.status // 'pending' | 'shipped' | 'delivered'
    data.items  // readonly { sku: string; qty: number }[]
    return data
  }

  // Only pay for explain() on the failure path.
  logger.warn('unexpected order payload', { failures: affirm.explain(data, orderPayload).failures }) // safe to log: no raw values
  return null
}
```

Hoist params that are used more than once into an `as const` constant (§8.1) instead of repeating them.

### 5.4 Form validation: one error message per field

`explain()` reports every failing key, so one field can produce several failures (for example `age` failing both `isInteger` and `isBetween`). Keep the first failure per path:

```ts
function fieldErrors(report: AffirmReport): Record<string, string> {
  const errors: Record<string, string> = {}
  for (const f of report.failures) errors[f.path] ??= f.reason
  return errors
}
```

`reason` is written for developers (`age: expected an integer, received number`). For end-user copy, map on `f.path` and `f.key` to your own messages:

```ts
const messages: Record<string, string> = {
  'email:matches': 'Enter a valid email address',
  'name:isBlank': 'Name is required',
  'age:isBetween': 'You must be at least 13',
}
const text = messages[`${f.path}:${f.key}`] ?? 'Invalid value'
```

### 5.5 Filtering arrays

An inline arrow works directly: TypeScript infers the type predicate, including for refined checks.

```ts
const raw: unknown[] = await loadRows()

const names = raw.filter((r) => affirm(r, { isType: 'string', isBlank: false }))
// (string & Refined)[]: usable anywhere string[] is

const users = raw.filter((r) => affirm(r, { shape: { id: { isType: 'string' } } }))
// ({ id: string } & Refined)[]

const present = maybeNames.filter((n) => affirm(n, { isPresent: true }))
// string[] (exact check, so no Refined marker)
```

For a reusable guard, name its type with `Affirmed`:

```ts
const orderParams = { shape: { id: { isType: 'string' }, total: { isFiniteNumber: true } } } as const
type ValidOrder = Affirmed<unknown, typeof orderParams>

export function isValidOrder(v: unknown): v is ValidOrder {
  return affirm(v, orderParams)
}

const orders = rows.filter(isValidOrder) // ValidOrder[]
```

### 5.6 Narrowing a typed value (not `unknown`)

`affirm` works on values that are already typed, and keeps the existing type:

```ts
function greet(user: User | null) {
  if (affirm(user, { isNull: true })) return 'Hello, guest' // a positive check for the state you mean (§9)
  user // User (isNull is exact, so the code after the early return is narrowed)

  if (affirm(user.nickname, { isType: 'string', isBlank: false })) {
    return `Hi, ${user.nickname}` // string
  }
  return `Hello, ${user.name}`
}
```

With a typed input, `shape` keeps the original type instead of building a new one. On `User | null`, `{ shape: { id: { isType: 'string' } } }` narrows to `User & Refined`.

### 5.7 Building params conditionally

`undefined` means skip, so you can build params with ternaries:

```ts
function passwordParams(strict: boolean) {
  return {
    isType: 'string',
    hasMinLength: strict ? 12 : 8,
    matches: strict ? /[^A-Za-z0-9]/ : undefined,   // only in strict mode
  } as const
}
```

Never use `false` to mean "skip" a boolean key, because `false` is an assertion too (rule 4). A common slip:

```ts
{ isBlank: !allowBlank }               // ✗ when allowBlank is true this is `isBlank: true`: it REQUIRES a blank string
{ isBlank: allowBlank ? undefined : false } // ✓ skip when blanks are allowed, otherwise require non-blank
```

---

## 6. Reports and errors in detail

### 6.1 `AffirmReport` / `AffirmFailure`

```ts
interface AffirmReport { ok: boolean; failures: AffirmFailure[] }

interface AffirmFailure {
  key: string        // the params key that failed: 'isBetween'
  path: string       // '' at the root, 'email', 'items[1].qty', 'user.address.zip'
  expected: string   // 'between 13 and 130 (inclusive)'
  received: string   // a description of the value's type, never the value: 'number', 'string(len 4)', 'array(len 2)', 'object{3 keys}', 'null'
  reason: string     // `${path}: expected ${expected}, received ${received}`
  branches?: AffirmFailure[][] // anyOf only: each branch's failures
}
```

Real output for the §5.1-style params against `{ email: 'nope', age: 12.5, role: 'owner', items: [{ sku: 'A', qty: 1 }, { sku: ' ', qty: 0 }], nickname: 42 }`:

```text
email: expected a string matching /^[^@\s]+@[^@\s]+$/, received string(len 4)
age: expected an integer, received number
age: expected between 13 and 130 (inclusive), received number
role: expected one of ["admin", "member"], received string(len 5)
items[1].sku: expected a non-blank string, received string(len 1)
items[1].qty: expected >= 1, received number
nickname: expected any of 2 branches to pass, received number
```

The `nickname` failure's `branches` holds `[[isUndefined failure], [isType failure, hasMaxLength failure]]`. The top-level `reason` of an `anyOf` failure is generic, so look in `branches` if you need to say which alternative came closest.

### 6.2 Logging safety

`received` never contains the checked value, so reports are safe to log even when the data holds PII. **Params can appear**, though: short string params are quoted in `expected` (`=== "admin"`, `one of ["admin", "member"]`). Don't put secrets in params. For example, never write `affirm(token, { is: process.env.API_KEY })`, because the key would end up in `expected`.

### 6.3 `AffirmError`

```ts
try {
  affirm.assert(body, createUserParams)
} catch (error) {
  if (error instanceof AffirmError) return badRequest(error.report.failures)
  throw error
}
```

- `error.name === 'AffirmError'` and `error.report` is the full `AffirmReport`.
- The default message is `affirm.assert failed: ` followed by the first three reasons and `(+N more)`. If you pass a `message` argument, it replaces the default message entirely, and the details remain in `error.report`.
- Use `instanceof AffirmError` to tell data failures apart from `TypeError`s (mistakes in params) and anything else.

### 6.4 Mistakes that throw `TypeError`

These are bugs in the params, not in the data. The messages are designed to tell you how to fix them:

```text
affirm: unknown check `isTypo`. Did you mean `isType`?
affirm: unknown check `hasMinLenght`. Did you mean `hasMinLength`?
affirm: params are empty; `{}` would always pass
affirm: invalid param for `matches`: expected a RegExp (received "abc"); use `includes` for plain text
affirm: invalid param for `isType`: expected a type tag; use `isNull: true` instead of `isType: 'null'`
affirm: invalid param for `isType`: expected a type tag, guard or schema; use `isInstanceOf: Map` for classes
```

Other cases that throw: `hasMinLength: -1` or `hasMinLength: '3'`, `isBetween: [10, 1]`, `isMultipleOf: 0`, `anyOf: []`, `shape: {}`, and async schemas.

Most of these are also **compile errors** (§7.3), so they rarely reach runtime in TypeScript code. They do when params are built from untyped data or cast with `as any`.

---

## 7. Type narrowing: what you can rely on

### 7.1 Exact vs refined

- **Exact checks narrow both branches.** These are `isNull`, `isUndefined`, `isNullish`, `isDefined`, `isPresent`, `isType` with a primitive tag (not `'object'`) or a type guard, `isArray: true`, `isFunction: true`, `is` / `isOneOf` with literal params, and `anyOf` when every branch is exact.

  ```ts
  declare const s: string | null
  if (affirm(s, { isPresent: true })) { s /* string */ } else { s /* null */ }
  ```

- **Refined checks narrow only the `if` branch.** That is every other key. The `if` branch gets `T & Refined`, and the `else` branch keeps the full type, because a string can fail `hasMinLength: 3` and still be a string.

  ```ts
  declare const x: string | number
  if (affirm(x, { isType: 'string', hasMinLength: 3 })) { x /* string & Refined */ } else { x /* string | number */ }
  ```

  `Refined` is a phantom marker. `string & Refined` can be assigned to `string`, passed to functions, returned and stored. Ignore it, and don't write it in your own type annotations. Use `Affirmed<…>` when you need to name the type.

  The consequence for generated code: put the code that relies on a refined narrowing **inside** `if (affirm(…)) { … }`, or use `affirm.assert`, which narrows the rest of the scope. Don't reach for a negated guard clause; that is banned (§9).

  ```ts
  affirm.assert(x, { isType: 'string', isBlank: false })
  x // string & Refined ✓
  ```

### 7.2 When `affirm` returns a plain `boolean`

If a refined check's narrowed type could still include `null` or `undefined`, TypeScript can't express the narrowing soundly, so `affirm` falls back to `boolean` and does not narrow:

```ts
declare const name: string | undefined
if (affirm(name, { isFalsy: true })) { name /* still string | undefined */ }
```

To get narrowing, split the check: `affirm(x, { isPresent: true }) && affirm(x, { … })`.

### 7.3 Compile-time errors you will see

Unknown keys (at any depth) and contradictions show up as **"No overload matches this call."** The useful part is the `__affirmError` text further down the error:

```text
Property '__affirmError' is missing … { __affirmError: "`isNull: true` contradicts `isPresent: true`" }
Property '__affirmError' is missing … { __affirmError: "`isType: 'string'` contradicts `isPositive` (a number key)" }
```

Other detected contradictions include `hasMinLength` greater than `hasMaxLength`, `isEmpty` with `isNotEmpty`, `isArray: true` with a non-`'object'` `isType` tag, and `isTruthy` with `isFalsy`. Contradictions are checked inside each nested params object, but not across `anyOf` branches.

### 7.4 What each common pattern narrows to (on `unknown`)

| Params | `if` branch type |
| --- | --- |
| `{ isType: 'string' }` | `string` |
| `{ isType: 'string', isBlank: false }` | `string & Refined` |
| `{ isOneOf: ['a', 'b'] }` (inline) | `'a' \| 'b'` |
| `{ isArray: true }` | `readonly unknown[]` |
| `{ isArray: true, everyItem: { isType: 'string' } }` | `readonly string[] & Refined` |
| `{ isPlainObject: true }` | `Record<string, unknown> & Refined` |
| `{ hasKey: 'id' }` | `Record<'id', unknown> & Refined` |
| `{ hasPath: 'a.b' }` | `{ a: { b: unknown } } & Refined` |
| `{ shape: { id: { isType: 'string' }, n: { isOneOf: [1, 2] } } }` | `{ id: string; n: 1 \| 2 } & Refined` |
| `{ shape: { x: { anyOf: [{ isUndefined: true }, { isType: 'string' }] } } }` | `{ x: string \| undefined } & Refined` |
| `{ isInstanceOf: Map }` | `Map<unknown, unknown> & Refined` |
| `{ isType: isUuid }` (a guard) | the guard's type |
| `{ isType: ZodSchema }` | the schema's input type `& Refined` |
| `{ satisfies: namedGuard }` | the guard's type `& Refined` |

---

## 8. Pitfalls that compile but are wrong

### 8.1 Hoisted params need `as const` (enforced, autofixable)

Inline params get literal types automatically. Params stored in a variable do not. TypeScript widens them where they are declared (`'a'` → `string`, `true` → `boolean`), before `affirm` ever sees them, so `affirm` can't recover the exact values. The runtime check still compares the exact strings; only the narrowing is lost:

```ts
const p = { isType: 'string', hasMinLength: 3 }
affirm(x, p)
// ✗ compile error: Type 'string' is not assignable to type '… | TypeTag | undefined'

const q = { isOneOf: ['a', 'b'] }
affirm(x, q) // compiles, but narrows to `string & Refined`, not 'a' | 'b'

const r = { isType: 'string', hasMinLength: 3, isOneOf: ['a', 'b'] } as const   // ✓
const s = { isType: 'string' } as const satisfies AffirmParams                    // ✓ and checked where it is declared
```

**Don't annotate params as `AffirmParams`** (`const p: AffirmParams = { … }`), and don't cast them (`{ … } as AffirmParams`). The literal types are lost and nothing narrows. Use `as const`, or `as const satisfies AffirmParams`.

**The `affirm/const-params` lint rule enforces this** in TypeScript files (§1). It follows every variable that ends up in params:
- params passed to `affirm()`, `affirm.assert()` or `affirm.explain()`;
- pieces inside params (`isOneOf: roles`, `shape: { id: idParams }`, `...baseParams`), including pieces of other hoisted params.

`eslint --fix` adds `as const` at the declaration (before any `satisfies`). It only autofixes when the variable is used purely as params, so making it read-only can't break anything. If the variable is also used elsewhere (`roles.push(…)`), you get the same fix as an editor suggestion to apply after checking. Typed declarations get a suggestion to switch to `as const satisfies <Type>`.

```ts
const roles = ['admin', 'member']   // ✗ affirm/const-params: params `roles` need `as const` … (autofix adds it)
affirm(user.role, { isOneOf: roles })
```

**Params exported to other files are covered too.** ESLint checks one file at a time, so the rule also recognises params by their keys where they are declared, whether or not that file calls `affirm`. An object literal counts as params when every key is a check name and at least one key, here or in its nested params, is distinctive (an `isX` / `hasX` check, `containsAll`, `everyItem`, …):

```ts
// params.ts (no affirm() call in this file)
export const orderParams = { isPlainObject: true, shape: { … } }   // ✗ recognised by its keys; autofix adds `as const`
export const manifest = { matches: ['<all_urls>'] }                // ✓ `matches` alone is an ordinary word, not params
export const ROLES = ['admin', 'member']                            // not recognised: a bare list has no keys
```

The remaining gap is **bare lists exported from another file** (`isOneOf: ROLES` where `ROLES` is imported). A list has no keys to recognise, so the rule only catches one when it's declared in the same file as its use. Write lists that are used in params `as const` where they're declared.

### 8.2 Inline functions in params need an annotated parameter

If **any** function written inline in the params has an unannotated parameter, narrowing is switched off for the **whole call**. That covers `satisfies`, `isType` guards, and functions nested inside `shape`, `everyItem` and `anyOf`. The call still compiles and still checks correctly at runtime. Only the types are lost.

```ts
affirm(x, { isType: 'string', satisfies: (v) => v !== 'x' })          // ✗ x stays `unknown`
affirm(x, { isType: 'string', satisfies: (v: unknown) => v !== 'x' }) // ✓ x: string & Refined

affirm(x, { satisfies: (v): v is Date => v instanceof Date })          // ✗ no narrowing
affirm(x, { isType: (v): v is Date => v instanceof Date })             // ✗ no narrowing either
affirm(x, { satisfies: (v: unknown): v is Date => v instanceof Date }) // ✓ Date & Refined

const isDate = (v: unknown): v is Date => v instanceof Date
affirm(x, { satisfies: isDate })                                       // ✓ named functions are always fine
```

The rule: **write `(v: unknown) =>` for every inline function in params**, or use a named function.

Why this happens: an unannotated arrow makes TypeScript infer the params type in two passes. In the first pass, the narrowing overload's soundness gate (§7.2) sees a not-yet-inferred `P`, so TypeScript rejects that overload and uses the plain-`boolean` one instead.

### 8.3 Don't destructure `assert`

```ts
const { assert } = affirm
assert(x, { isType: 'string' })
// ✗ TS2775: Assertions require every name in the call target to be declared with an explicit type annotation.
```

Always call it as `affirm.assert(…)`. The same applies to re-exporting it under another name: `export const check = affirm.assert` loses the assertion signature unless you annotate it with `Affirm['assert']`.

### 8.4 Silent failures from using the wrong kind of key

Each of these compiles and always returns `false`:

| Wrong | Right |
| --- | --- |
| `affirm(tags, { includes: 'x' })` on an array | `contains: 'x'` |
| `affirm(text, { contains: 'x' })` on a string | `includes: 'x'` |
| `affirm(req.query.page, { isInteger: true })` (query values are strings) | `matches: /^\d+$/`, then `Number()` and check again |
| `affirm(input, { isEmpty: true })` meaning "null or empty" | `anyOf: [{ isNullish: true }, { isEmpty: true }]` |
| `affirm(maybe, { isPositive: false })` meaning "not a positive number, or not a number" | `not: { isPositive: true }` |
| `affirm(obj, { hasMinLength: 1 })` on a plain object | `isNotEmpty: true` (size keys other than `isEmpty` / `isNotEmpty` don't accept plain objects) |
| `affirm(user, { shape: { name: { isType: 'string' } } })` on a class instance with a `get name()` | `isInstanceOf: User`, or `satisfies` |
| `shape: { nickname: { isType: 'string' } }` for an optional field | `anyOf: [{ isUndefined: true }, { isType: 'string' }]` |

### 8.5 Things `affirm` deliberately doesn't do

- **No parsing, coercion, trimming or defaults.** `affirm` never changes the value. Parse first (`Number(…)`, `new Date(…)`, a schema's `.parse`), then check the result.
- **No async.** Await first, then check.
- **No custom messages per key.** Map `path` / `key` to your own messages (§5.4).
- **No `bigint` comparisons.** `isGreaterThan` and the other number keys need a `number`.

---

## 9. Never negate `affirm()`

### What is banned

```ts
if (!affirm(value, params)) { … }        // ✗
if (!(affirm(value, params))) { … }      // ✗
if (affirm(value, params) === false) …   // ✗ also `== false`, `!== true`, `!= true`
if (!(x != null && affirm(x, params))) … // ✗ negating an && / || that contains affirm()

const ok = affirm(value, params)          // also `let` / `var` if never reassigned, and `affirm(a, p) && affirm(b, q)`
if (!ok) { … }                           // ✗ a negated stored result

const isOrder = (v: unknown) => affirm(v, orderParams)
if (!isOrder(x)) { … }                   // ✗ a negated wrapper (a same-file function whose whole body returns affirm())
```

The `affirm/no-negated-affirm` lint rule (§1) reports each of these as an error and quotes the attempted code:

```text
affirm: `!affirm(body, createUserParams)` is not allowed. Negating affirm() is true when any
check fails for any reason, so it tells you nothing reliable about the value. Use
affirm.assert(value, params) to stop on bad data, affirm.explain(value, params) to handle
failures by reason, or a positive check for the state you mean (e.g. `isNullish: true`).
```

### Why

`affirm(value, params)` answers one precise question: "does `value` pass **every one** of these checks?" A `true` result describes one well-defined set of values, and TypeScript narrows to it.

Its negation is everything else. Take `!affirm(order, { isPlainObject: true, shape: { total: { isFiniteNumber: true, isPositive: true } } })`. It is true when `order` is `null`, a string, an array, an object without `total`, a `total` of `'12'`, `NaN`, `0` or `-5`. Those are very different situations, and code written under the negation:

- **can't rely on anything about the value.** The check is a thin gate made of many narrow conditions, and negating it throws all of them away at once;
- **can't say what was wrong**, so the failure is handled blindly (a generic error, a silent `return null`, a wrong default);
- **gets no type information** for refined checks, because TypeScript can't describe "any value except a valid one".

This mostly bites in generated code. A negated guard clause (`if (!affirm(…)) return`) looks tidy, but the branch it guards is the vaguest part of the program.

### What to write instead

| You want to… | Write |
| --- | --- |
| Stop on bad data (a bug, a fatal misconfiguration) | `affirm.assert(value, params, 'message')`. It throws `AffirmError` with the full report and narrows `value` afterwards. |
| Reject bad input with reasons (HTTP 400s, form errors) | `const report = affirm.explain(value, params); if (!report.ok) return badRequest(report.failures)`, then `affirm.assert(value, params)` to narrow (§5.1). |
| Fall back quietly | Put the main path in the positive branch: `if (affirm(value, params)) return use(value)`, then `return fallback`. |
| Handle a specific state such as "missing" | Check that state positively: `if (affirm(user, { isNull: true })) return guest()`. Exact checks narrow the code after an early return (§7.1). |
| Exclude a specific value inside a check | Use the `not:` key: `affirm(role, { isType: 'string', not: { isOneOf: ['root'] } })`. It negates one named sub-check, not the whole gate, so it's allowed. |

When `if (!affirm(…)) throw new X('message')` is flagged, the rule offers an editor suggestion to replace it with `affirm.assert(…, 'message')`. It's a suggestion, not an autofix, because the thrown error becomes an `AffirmError`.

### Guards built on `affirm` follow the same rule

A reusable guard such as `isValidOrder(v)` (§5.5) is `affirm` under another name, so `!isValidOrder(v)` is exactly as broad as `!affirm(v, params)`. Use guards in the positive branch, or call `affirm.assert` / `affirm.explain` with their params.

ESLint checks one file at a time, so in the file that *imports* `isValidOrder`, nothing says it wraps `affirm`. The `guards` setting (§1) closes that gap with a **naming contract**:

- **`affirm/guard-naming`** (where guards are defined): every named function whose whole body returns `affirm(…)` must match the pattern, and no other function defined in the project may match it.
- **`affirm/no-negated-affirm`** (where guards are used): a negated call to any function matching the pattern is reported, wherever it was imported from.

```ts
// guards.ts
export const isValidOrder = (v: unknown) => affirm(v, orderParams)  // ✓ matches '^isValid'
export const checkUser = (v: unknown) => affirm(v, userParams)      // ✗ guard-naming: must match '^isValid'
export function isValidEmail(s: string) { return s.includes('@') }  // ✗ guard-naming: '^isValid' is reserved for guards

// handler.ts
import { isValidOrder } from './guards'
if (!isValidOrder(body)) return null                                // ✗ no-negated-affirm, even across files
```

The two halves cover each other: a guard can't escape the pattern, and nothing that isn't a guard can match it. Two limits remain:
- Inline callbacks (`.filter((r) => affirm(r, p))`) have no name, so they aren't checked. They aren't reusable either.
- **Only your own code counts as a guard.** A negated call is checked against the pattern when the function is defined in the same file, imported from a relative path (`./guards`), or imported from a prefix listed in `guardModules`. Anything imported from a package is ignored, so `validator.isValidPhoneNumber(x)` or `import { isValidUrl } from 'url-kit'` never trips the rule. If you import your own guards through a path alias (`@/guards`), list the alias in `guardModules`, or those guards are treated like a package and go unchecked.

Without `guards`, same-file wrappers are still caught. For imported guards it is then a convention only.

### Escape hatch

If a negation really is precise in context (for example, legacy code where you know only `null` reaches the branch), disable the rule for that line **and write the reason** after `--`:

```ts
// eslint-disable-next-line affirm/no-negated-affirm -- legacy handler: only null reaches this branch
if (!affirm(x, params)) return // ✗ allowed only with the disable comment above
```

That keeps each exception deliberate, visible in review, and searchable (`grep -r "no-negated-affirm --"`). Never disable the rule for a whole file or project. Turn on `linterOptions: { reportUnusedDisableDirectives: 'error' }` so that stale disable comments get cleaned up.

### Allowed, with care

- **`!report.ok`** from `affirm.explain` is fine. It is the recommended form, because the failures are right there to use.
- **`if (affirm(…)) { … } else { … }`** is allowed. Be aware that the `else` branch is just as broad as `!affirm`: treat it as "not valid, reason unknown". If the `else` needs the reason, use `explain`.

---

## 10. Checklist for reviewing generated `affirm` code

- [ ] Value first, params second.
- [ ] No negated `affirm()`: no `!affirm(…)`, `=== false`, `!ok`, or `!isSomeGuard(x)` for a guard built on `affirm`. `settings.affirm.guards` is set, and guards are named by it. Any `eslint-disable` for the rule has a reason after `--`. Failure paths use `assert`, `explain` or a positive check, and `affirm/no-negated-affirm` is enabled.
- [ ] Optional fields use `anyOf: [{ isUndefined: true }, …]`. Nullable fields use `isNull`. Fields that can be both use `isNullish`.
- [ ] `isPlainObject: true` is present when arrays must be rejected (`shape` and `isType: 'object'` accept arrays).
- [ ] `everyItem` is paired with `isNotEmpty: true` when an empty array is invalid.
- [ ] No `includes` on arrays and no `contains` on strings.
- [ ] Numeric checks run on numbers, not on numeric strings from env vars, query strings or form fields.
- [ ] `isFiniteNumber` or `isInteger` is used instead of bare `isType: 'number'` when `NaN` / `Infinity` must be rejected.
- [ ] Hoisted params use `as const`, and are never annotated or cast as `AffirmParams` (`affirm/const-params`; `eslint --fix` adds it).
- [ ] Every inline function in params annotates its parameter: `(v: unknown) =>`.
- [ ] `affirm.assert` is called as a method, never destructured.
- [ ] `explain()` is used only where its failures are used, and `affirm()` everywhere else.
- [ ] No `try/catch` around `affirm()` / `explain()`. `TypeError`s are bugs to fix.
- [ ] No secrets in params.

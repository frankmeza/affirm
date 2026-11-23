# affirm — Design Spec

Status: draft v1 · Owner: Frank · Package: `affirm` (private, local use only)

## 1. Goal

One function, `affirm(value, params)`, that replaces compound data-soundness checks with a readable object of named checks:

```ts
// before
if (order && typeof order === 'object' && 'total' in order && typeof order.total === 'number' && order.total > 0) { … }

// after
if (affirm(order, { hasKey: 'total', shape: { total: { isType: 'number', isPositive: true } } })) { … }
```

Primary consumer: AI coding agents writing application code in a project that depends on this package. Secondary: the humans reviewing that code. Every design choice optimises for (a) an agent guessing correctly and (b) a reviewer reading the check aloud as a sentence.

## 2. Non-goals (v1)

- Not a schema/validation library. No coercion, no transforms, no defaults, no parsing. Use Zod/Valibot for that; `affirm` can call their schemas via Standard Schema.
- No async checks.
- No custom per-key error messages, no i18n.
- No runtime dependencies. Zero.

## 3. Public API

```ts
import { affirm, AffirmError } from 'affirm'

affirm(value, params)            // → boolean, and a type predicate that narrows `value`
affirm.explain(value, params)    // → AffirmReport  (never throws on data failure)
affirm.assert(value, params, message?) // → asserts value is …; throws AffirmError on failure
```

Exports: `affirm`, `AffirmError`, and types `AffirmParams`, `AffirmReport`, `AffirmFailure`, `Affirmed<V, P>` (the narrowed type, for users who need to name it).

A second entry point, `affirm/eslint`, exports an ESLint 9 flat-config plugin with one rule, `no-negated-affirm` (D8). It has no runtime dependencies; `eslint` is an optional peer dependency.

`affirm` is declared as a `const` with an explicit interface type so that `affirm.assert` can carry an `asserts` signature (TS requires explicit annotations on the call target for assertion functions).

## 4. Core semantics (the rules agents must be able to predict)

1. **Value is separate from params.** `affirm(value, params)`. Never `affirm({ value, … })`.
2. **Keys combine with AND.** All present keys must pass. OR is only via `anyOf`.
3. **Omitted key = skip.** A key whose value is `undefined` is also skipped (lets callers build params conditionally).
4. **Boolean keys: `true` asserts, `false` asserts the negation.** `isNull: false` means "is not null". This is uniform: for every boolean key, pass ⇔ `check(value) === param`. (Decision taken from the design discussion; flip here first if it changes.)
5. **No coercion, wrong kind fails.** `hasMinLength: 3` on a number fails (reason: "not measurable"); it does not throw. `isGreaterThan: 5` on `"10"` fails.
6. **Programmer errors throw, data failures return false.** These throw `TypeError` from all three entry points:
   - unknown key (message includes a "did you mean `hasKey`?" suggestion via edit distance),
   - empty params `{}` (would be vacuously true),
   - wrong param type (`hasMinLength: '3'`, `matches: 'abc'`),
   - a Standard Schema whose `validate` returns a Promise.
7. **Evaluation order is canonical, not object-key order.** Cheap type/nullish checks first, then size/number/string, then structural (`shape`, `everyItem`, …), then `satisfies`. `affirm()` short-circuits on the first failure; `explain()` evaluates every key and collects all failures. Composite keys skip their children if the value is the wrong kind (one failure, not a cascade).
8. **Equality is `===`** for `is`/`isNot`, SameValueZero for `isOneOf`/`contains*` (so `NaN` can be found in a list). `isDeepEqual` is structural (§7).

## 5. Key reference

"Narrows to" is the type intersected with the input type when the check is `true`. "Exact" is explained in §6: exact keys also narrow the `else` branch; refined keys only narrow the `if` branch.

### Equality & membership

| Key           | Param                | Passes when                         | Narrows to     | Exact                                   |
| ------------- | -------------------- | ----------------------------------- | -------------- | --------------------------------------- |
| `is`          | `unknown`            | `value === param`                   | `typeof param` | only if param is a literal type         |
| `isNot`       | `unknown`            | `value !== param`                   | —              | no                                      |
| `isOneOf`     | `readonly unknown[]` | list includes value (SameValueZero) | `P[number]`    | only if every element is a literal type |
| `isNotOneOf`  | `readonly unknown[]` | list does not include value         | —              | no                                      |
| `isDeepEqual` | `unknown`            | structural equality (§7)            | —              | no                                      |

### Nullish & truthiness (boolean keys; `false` = negation)

| Key                                  | `true` narrows to   | `false` narrows to  | Exact |
| ------------------------------------ | ------------------- | ------------------- | ----- |
| `isNull`                             | `null`              | `{} \| undefined`   | yes   |
| `isUndefined`                        | `undefined`         | `{} \| null`        | yes   |
| `isNullish`                          | `null \| undefined` | `{}`                | yes   |
| `isDefined` (≠ undefined)            | `{} \| null`        | `undefined`         | yes   |
| `isPresent` (≠ null and ≠ undefined) | `{}`                | `null \| undefined` | yes   |
| `isTruthy`                           | `{}`                | —                   | no    |
| `isFalsy`                            | —                   | `{}`                | no    |

### Runtime type

| Key                                      | Param                                                                     | Passes when                                                     | Narrows to                      | Exact                               |
| ---------------------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------- | ----------------------------------- |
| `isType`                                 | `'string' \| 'number' \| 'boolean' \| 'bigint' \| 'symbol' \| 'function'` | `typeof value === tag`                                          | mapped type                     | yes                                 |
| `isType`                                 | `'object'`                                                                | `typeof value === 'object' && value !== null` (arrays included) | `object`                        | no (TS `object` includes functions) |
| `isType`                                 | `(v: unknown) => v is T`                                                  | guard returns true                                              | `T`                             | yes (same contract as a TS guard)   |
| `isType`                                 | Standard Schema (sync)                                                    | `validate()` has no issues                                      | `InferOutput<S>`                | no                                  |
| `isArray`                                | boolean                                                                   | `Array.isArray`                                                 | `readonly unknown[]`            | yes (when `true`)                   |
| `isPlainObject`                          | boolean                                                                   | proto is `Object.prototype` or `null`                           | `Record<string, unknown>`       | no                                  |
| `isFunction`                             | boolean                                                                   | `typeof === 'function'`                                         | `(...args: never[]) => unknown` | yes (when `true`)                   |
| `isInstanceOf`                           | `abstract new (...a: any) => any`                                         | `instanceof`                                                    | `InstanceType<C>`               | no                                  |
| `isValidDate`                            | boolean                                                                   | `Date` instance with non-NaN time                               | `Date`                          | no                                  |
| `isInteger` / `isFiniteNumber` / `isNaN` | boolean                                                                   | `Number.isInteger` / `Number.isFinite` / `Number.isNaN`         | `number`                        | no                                  |

`'undefined'` and `'null'` are deliberately not `isType` tags: use `isUndefined` / `isNull`. Passing a class constructor to `isType` throws with "use `isInstanceOf`".

### Emptiness & size

"Measurable" = string, array, `Map`, `Set`. `isEmpty`/`isNotEmpty` also accept plain objects (own enumerable keys).
| Key | Param | Passes when | Narrows to |
|---|---|---|---|
| `isEmpty` / `isNotEmpty` | boolean | size === 0 / size > 0 (non-measurable fails both) | — |
| `isBlank` | boolean | string and `trim() === ''` | `string` |
| `hasLength` / `hasMinLength` / `hasMaxLength` | number (non-negative integer) | size ===, >=, <= | `string \| readonly unknown[] \| ReadonlyMap<unknown, unknown> \| ReadonlySet<unknown>` |

`isEmpty(null)` fails. Agents wanting "null or empty" write `anyOf: [{ isNullish: true }, { isEmpty: true }]`. All refined.

### Numbers (value must be `number` and not NaN; all narrow to `number`, all refined)

`isGreaterThan`, `isAtLeast` (>=), `isLessThan`, `isAtMost` (<=): number · `isBetween: readonly [min, max]` **inclusive** both ends · `isPositive` (> 0), `isNegative` (< 0): boolean · `isMultipleOf: number` (`value % n === 0`). `bigint` is out of scope for v1.

### Strings (value must be `string`; narrow to `string`; refined)

`startsWith`, `endsWith`, `includes`: string · `matches: RegExp` (reset `lastIndex` before testing so `/g` and `/y` regexes are stateless). `includes` is string-only; arrays use `contains`.

### Objects (value must be a non-null object or array)

| Key           | Param                                                              | Passes when                                                                   | Narrows to                             |
| ------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------- | -------------------------------------- |
| `hasKey`      | `PropertyKey`                                                      | `Object.hasOwn(value, key)`                                                   | `Record<K, unknown>`                   |
| `hasKeys`     | `readonly PropertyKey[]`                                           | has all (own)                                                                 | `Record<K[number], unknown>`           |
| `hasAnyKey`   | `readonly PropertyKey[]`                                           | has at least one                                                              | `object`                               |
| `hasOnlyKeys` | `readonly PropertyKey[]`                                           | no own key outside the list (does not require all present)                    | `object`                               |
| `hasPath`     | `string` (dot path, numeric segments index arrays: `'items.0.id'`) | every segment exists as an own key                                            | nested object type built from the path |
| `shape`       | `{ [key]: AffirmParams }`                                          | each listed field passes its params (missing field is checked as `undefined`) | `{ [K]: Affirmed<unknown, S[K]> }`      |

Own-key semantics are deliberate (data from JSON/APIs). Class instances with prototype getters → use `satisfies`. All refined (structural typing can't distinguish own vs prototype keys).

### Arrays (value must be an array)

`contains: unknown` · `containsAll` / `containsAny: readonly unknown[]` (SameValueZero) · `everyItem: AffirmParams` (vacuously true on `[]`; narrows to `readonly Affirmed<unknown, P>[]`) · `someItem: AffirmParams` (false on `[]`). All refined.

### Composition & escape hatches

| Key         | Param                                 | Passes when            | Narrows to                       |
| ----------- | ------------------------------------- | ---------------------- | -------------------------------- |
| `not`       | `AffirmParams`                        | the nested params fail | —                                |
| `anyOf`     | `readonly AffirmParams[]` (non-empty) | any branch passes      | union of each branch's narrowing |
| `satisfies` | `(v) => boolean` or guard             | predicate returns true | guard's type if a guard, else —  |

## 6. Type narrowing design (the hard part)

### 6.1 Signature

```ts
interface Affirm {
  <V, const P extends AffirmParams>(
    value: V,
    params: P & NoContradictions<P>,
  ): value is Affirmed<V, P>;
  explain<const P extends AffirmParams>(
    value: unknown,
    params: P & NoContradictions<P>,
  ): AffirmReport;
  assert<V, const P extends AffirmParams>(
    value: V,
    params: P & NoContradictions<P>,
    message?: string,
  ): asserts value is Affirmed<V, P>;
}
```

`const P` preserves literal types so `is: 'admin'` narrows to `'admin'`, not `string`.

As implemented, `NoContradictions<P>` is one part of `ParamsCheck<P> = NoUnknownKeys<P> & NoContradictions<P>`; the signature intersects P with `ParamsCheck<P>` (see the §6.3 outcome).

### 6.2 The soundness problem

A TS type predicate narrows both branches. If `affirm(x, { isType: 'string', hasMinLength: 3 })` were typed `value is string`, then in the `else` branch TS would remove `string` from `x`'s type, even though `"ab"` lands there. That makes the library actively harmful.

### 6.3 Solution: exact vs refined, with a phantom brand

- `Affirmed<V, P> = V & N<P>` when **every** key in P is _exact_ (true for a value of type `N` ⇔ check passes at runtime). Then excluding `N` in the `else` branch is correct.
- Otherwise `Affirmed<V, P> = V & N<P> & Refined`, where
  ```ts
  declare const refined: unique symbol;
  type Refined = { readonly [refined]?: never };
  ```
  No real type is a subtype of `Refined`, so the `else` branch excludes nothing, while the `if` branch still gets `V & N` (a `string & Refined` is usable anywhere a `string` is).
- Empty-narrowing keys (N = `unknown`) are always refined; otherwise `V & unknown = V` would make the `else` branch `never`.
- Exact keys: `is`/`isOneOf` with literal params, `isNull`, `isUndefined`, `isNullish`, `isDefined`, `isPresent` (both polarities), `isType` with primitive tags / `'function'` / a guard, `isArray: true`, `isFunction: true`. Everything else is refined.
- `anyOf` is exact only if every branch is exact; `shape`, `everyItem`, `someItem`, `not`, `satisfies` are always refined.

**Verify this early (implementation plan M2).** Type tests must prove: (a) the `if` branch narrows; (b) the `else` branch of a refined check keeps every constituent; (c) the `else` branch of an exact check excludes correctly; (d) branded values pass into functions expecting the unbranded type; (e) hovering an `Affirmed` type in an editor is readable (wrap in a `Simplify<>` where it helps). If the brand approach fails any of (a)–(d) on the current TypeScript, fall back to: refined combinations return plain `boolean` (no narrowing), exact-only combinations keep the predicate. Record the outcome in this section.

**Outcome (M2, 2026-11-10, TypeScript 7.0.2): the brand approach passes (a)–(e); no fallback needed.** Tests: `test/types/narrowing.test-d.ts`, each checked to fail when its expectation is broken. Findings:

- **`Affirmed<V, P>` filters V instead of intersecting it.** A plain `V & N` gives artefacts on unions: `string | string[]` with `isArray: true` would become `(string & readonly unknown[]) | string[]`. `Affirmed` copies TypeScript's own narrowing instead: keep the constituents of V that are subtypes of N, swap in N where N is narrower, and drop unrelated constituents. Only when nothing is related does it fall back to `V & N`. Result: `string[]`.
- **`value is Affirmed<V, P>` compiles with a generic `V`** (no TS2677), and `affirm.assert` needs the explicit `const affirm: Affirm` annotation (TS2775 otherwise), as expected.
- **The optional brand (`?: never`) is enough.** `{}` and `object` are *assignable* to it, but narrowing uses the strict subtype relation, so `else` branches keep those types too (tested).
- **Gated boolean keys narrow to their kind in both polarities (D7):** `isInteger: false` → `number & Refined`.
- **A non-literal param** (`isNull: someBoolean`, or a variable typed `AffirmParams`) narrows nothing: refined, with `n = unknown`.
- **Hover output is readable without `Simplify`:** `string & Refined`, `Map<unknown, unknown> & Refined`, `'a' | 'b'`, `{ id: string }`. Revisit `Simplify` for object narrowing (`shape`, `hasKey`) in M3/M4.
- **Unknown keys are compile errors** via `NoUnknownKeys<P>`, intersected next to `NoContradictions<P>` (see §6.1). Generic inference skips excess-property checks, so without it `{ isNull: true, isTypo: 1 }` would type-check. The editor shows `… '{ __affirmError: "unknown check 'isTypo'" }'`.
- **Known cosmetic gap:** when nothing in V is related to N, the fallback `V & N` can show impossible members, e.g. `(string | typeof Foo) & AnyFunction` for `isFunction: true`. It is sound (the `else` branch keeps everything), just noisy.

**Addendum (M4): the brand cannot carry `null` or `undefined`, so those refined results use the fallback.** `null & Refined` reduces to `never`. A refined result that can be `null`/`undefined` therefore lost those members in the `if` branch: `affirm(x: string | null, { isFalsy: true })` claimed `x: string` when it is usually `null`. Leaving `null` unbranded would instead wrongly remove it from the `else` branch, and TypeScript predicates can't express a one-sided narrowing. So:

- `CanNarrow<V, P>` is `false` when P is refined and `NarrowTo<V, Narrow<P>>` includes `null` or `undefined`.
- `affirm` and `affirm.assert` each have two overloads. The narrowing overload is disabled (its params type becomes `never`) when `CanNarrow` is false, so TypeScript picks the plain `boolean`/`void` overload. This is the §6.3 fallback, applied only where it's needed.
- Exact results may still contain `null` (`anyOf: [{ isNull: true }, { isType: 'string' }]` → `string | null`, `else` excludes it).
- Error UX: a compile error such as an unknown key now reads "No overload matches this call. The last overload gave the following error: … `unknown check 'isTypo'`".
- Tests: "soundness" block in `test/types/composites.test-d.ts`. Removing the guard produces 5 type errors there.

**Other M4 type changes:**

- Narrowings of different keys are combined with the same filtering as `Affirmed` (not plain `&`), so `isType: 'string'` + `hasMinLength` gives `string`, not `string & (string | readonly unknown[] | …)`.
- `shape` field types, `everyItem` elements and `anyOf` branches use the unbranded narrowing (`{ total: number }`, not `{ total: number & Refined }`). The outer call is always refined for `shape`/`everyItem`, so the inner brand would only add noise.
- Unknown keys are compile errors at any depth (shape fields, `everyItem`, `someItem`, `not`, `anyOf` branches).
- Nested narrowing stops recursing on the wide `AffirmParams` type, which otherwise hit "type instantiation is excessively deep".

### 6.4 Contradiction detection

`NoContradictions<P>` resolves to `unknown` when P is fine, or to `{ __affirmError: '<message>' }` so the editor shows a readable error at the call site. v1 rules (all for `true` values):

- `isNull` with `isTruthy`, `isPresent`, `isDefined`, `isUndefined`, or any `isType`
- `isUndefined` with `isTruthy`, `isPresent`, `isDefined`, or any `isType`
- `isNullish` with `isPresent`
- `isTruthy` with `isFalsy`
- `isEmpty` with `isNotEmpty`, or with `hasMinLength` ≥ 1
- `isArray: true` with `isType` other than `'object'`
- `isType: 'string'` with any number key; `isType: 'number'` with any string key
- `hasMinLength` > `hasMaxLength` (literal numbers only)

Keep the list small and certain. False positives are worse than misses.

**As implemented (M5), with three corrections to the list above:**

- **`isNull` + `isDefined` is not a contradiction and was dropped.** `isDefined` means "not `undefined`", and `null` passes both. (`isUndefined` + `isDefined` stays.)
- **"Any `isType`" means any `isType` *tag*.** A guard or schema may accept `null`/`undefined` (`(v): v is null | undefined`, `z.null()`), so those are not flagged.
- **"Any number key" includes the number-gated keys** `isInteger`, `isFiniteNumber`, `isNaN`, and any polarity of boolean number/string keys (`isType: 'string', isPositive: false` can never pass, per D7). String keys: `startsWith`, `endsWith`, `includes`, `matches`, `isBlank`.
- **Contradictions are checked inside nested params too** (shape fields, `everyItem`, `someItem`, `not`, `anyOf` branches), but not across them (`anyOf: [{ isNull: true }, { isPresent: true }]` is fine).
- **Messages read like:** "`isNull: true` contradicts `isPresent: true`", "`hasMinLength: 10` is greater than `hasMaxLength: 9`" (literal non-negative integers only; wide `number`s are never compared).
- **Type-level only:** at runtime these params simply fail.

## 7. `isDeepEqual` rules

Same-type required. Primitives by `Object.is` except `+0`/`-0` are equal. Arrays: same length, elementwise. Plain objects: same own enumerable string keys, valuewise. `Date`: same time. `RegExp`: same `source` and `flags`. `Map`: same size, same keys (SameValueZero), values deep-equal. `Set`: same size, every member present (SameValueZero; no deep matching of object members in v1). Class instances other than these: reference equality only. Cycles: track visited pairs; a pair already under comparison counts as equal.

## 8. Explain report

```ts
type AffirmReport = { ok: boolean; failures: AffirmFailure[] };

type AffirmFailure = {
  key: string; // 'hasMinLength'
  path: string; // '' at root; 'user.address.zip'; 'items[2].id'
  expected: string; // 'length >= 3'
  received: string; // value description, see below
  reason: string; // one human sentence: 'items[2].id: expected length >= 3, received string(len 2)'
  branches?: AffirmFailure[][]; // for anyOf: failures per branch
};
```

**`received` never contains raw values.** It's a type description: `null`, `undefined`, `string(len 2)`, `number`, `array(len 4)`, `object{3 keys}`, `Date(invalid)`, `Map(size 0)`. Reports end up in logs, and data checks run on PII. An opt-in `{ includeValues: true }` option is a possible v2.

Negated boolean keys read naturally: `expected: 'not null'`.

## 9. `AffirmError`

`class AffirmError extends Error` with `name = 'AffirmError'`, `report: AffirmReport`. Message: the caller's `message` if given, else `affirm.assert failed: ` + the first 3 `reason`s, then `(+N more)`.

## 10. Standard Schema

Detect via the `'~standard'` property. Vendor the `StandardSchemaV1` type definitions (the spec intends them to be copied; no dependency). Call `schema['~standard'].validate(value)`; if it returns a thenable, throw `TypeError` ("async schemas are not supported by affirm; validate them before calling affirm"). Map issues into `AffirmFailure`s with `key: 'isType'` and the issue path appended.

**As implemented (M5):**

- **Detection** requires `'~standard'.version === 1` and a `validate` function. Schemas may be objects (Zod, Valibot) or callable functions (ArkType); a callable schema is treated as a schema, not a guard.
- **Narrowing uses `InferInput<S>`, not `InferOutput<S>`.** affirm validates but never transforms, so after `isType: z.string().transform(Number)` the value is still the input `string`, not the output `number`. Refined, as specified (so nullable schemas fall back to `boolean`, §6.3 addendum).
- **Issue messages are not copied into reports.** Libraries may embed the received value in them (e.g. enum mismatches), which would break D5. Each issue becomes `expected: 'a value accepted by the <vendor> schema'`, and `received` describes the value at the issue's path. **Open question:** an opt-in to include messages, together with the possible `includeValues` v2 option (§8).
- **Async schemas:** the promise is given a no-op rejection handler before throwing, so discarding it can't cause an unhandled rejection.

## 11. Documentation contract (part of the API)

- Every key in `AffirmParams` has JSDoc: one-line meaning, the exact pass condition, and an `@example`. Agents read hover docs, and this is the main way they learn the API.
- Names follow a fixed grammar: `is*` = state, `has*` = possession, `contains*`/`matches`/`startsWith`… = search. New keys must fit it.
- `AGENTS.md` ships in the package and is the canonical usage guide for agents (see `AGENTS.md` at repo root).

## 12. Decisions log

| #   | Decision                                            | Why                                                                |
| --- | --------------------------------------------------- | ------------------------------------------------------------------ |
| D1  | `false` on a boolean key = negation                 | Uniform rule; omitted key already means skip                       |
| D2  | Own-key semantics for `has*`                        | Predictable on JSON data; prototype getters go through `satisfies` |
| D3  | `isBetween` inclusive                               | Most common intent; documented in JSDoc                            |
| D4  | Programmer errors throw, data failures return false | Typos must not silently pass or fail                               |
| D5  | Reports carry no raw values                         | Logs + PII                                                         |
| D6  | Refined-key brand for one-sided narrowing           | Prevents unsound `else` narrowing (§6.2); verify in M2             |
| D7. | isPositive question                                 | use rule 5 ("the wrong kind of value fails")                       |
| D8  | Negating `affirm()` is banned (`!affirm(…)`, `=== false`, `!ok`), enforced by the `affirm/no-negated-affirm` ESLint rule shipped as `affirm/eslint` | The negation of an AND of narrow checks is "something failed, for some reason": too broad to rely on, gives no reason and no narrowing. Use `assert`, `explain`, or a positive check. The `not:` key stays (it negates one named sub-check); `else` branches stay allowed but are documented as equally broad. Neither TypeScript nor the runtime can see a `!`, so a lint rule is the only enforcement point. The rule follows the result through `&&` / `\|\|`, variables assigned once, and same-file functions whose whole body returns it; imported guards are caught through a naming contract: with `settings.affirm.guards`, the `guard-naming` rule makes "returns affirm(…)" ⇔ "name matches the pattern" for functions defined in the project, and `no-negated-affirm` flags negated calls to matching names in any file (no type information needed). Only project code counts: same-file definitions, relative imports and `settings.affirm.guardModules` prefixes; package imports are ignored. The plugin is tested on ESLint 10 and, via `test:eslint9`, ESLint 9. Exceptions use `eslint-disable-next-line … -- reason`. |
| D9  | Supported TypeScript: **>= 5.9** (optional peer dependency); `test:types:ts59` checks the source, the tests and the published `.d.ts` with 5.9.3 | Checked 2026-11-23: 5.9.3, 6.0.3 and 7.0.2 pass every type test against the built `.d.ts`. 5.0, 5.4, 5.5 and 5.8 fail with "Type alias 'Narrow' circularly references itself" (the `AllInfos` tuple spreads loop back through `NarrowNested` for `shape` / `everyItem` / `anyOf`). Under `skipLibCheck` that is silent and unsound (every `else` branch becomes `never`). An interface indirection on `Narrow` did not fix it; supporting < 5.9 would mean restructuring how narrowing is assembled. Not worth it while 5.9 is the last 5.x and over a year old. |
| D10 | Hoisted params must be `as const`, enforced by the `affirm/const-params` ESLint rule (TypeScript files; autofix) | A params object declared apart from the call is widened where it is declared (`['a', 'b']` → `string[]`, `true` → `boolean`), so `affirm` receives no literal types and can't recover them. A type-level error isn't possible: a widened literal list looks exactly like a legitimately dynamic `string[]`. The rule follows variables into params (including nested pieces and spreads), autofixes only when the variable is used purely as params (so read-only can't break other uses), and suggests `as const satisfies T` for annotated or cast declarations. It also recognises params by their keys where they are declared, so params exported to other files are covered: every key must be a check name, with at least one distinctive key here or in nested params (generic words such as `shape`, `matches`, `anyOf`, `not` alone don't count, to avoid look-alikes like JSON Schema). `CHECK_KEYS` is a static copy of the registry, kept in sync by a test. Remaining gap: bare lists exported from another file (no keys to recognise). Type-aware linting could close it later (opt-in; unavailable on TypeScript 7). |

## 13. Open questions

- Q1: Package name / scope.
  - `affirm`, local usage only for now.
- Q2: Should `hasKey` etc. accept `Object.prototype`-free objects created with `Object.create(null)`? (Yes with `Object.hasOwn`; confirm with a test.)
  - yes, with reminders about this later if it starts to seem like it will become thorny.
- Q3: `bigint` support for number keys: v1.1?
  - yes, at a later version.
- Q4: An `affirm.is(params)` curried form returning a reusable guard (`const isOrder = affirm.is({...})`, usable in `.filter`). Cheap to add; probably v1.1.
  - yes with reminders, and expanded explanation later.

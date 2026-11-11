# assert — Implementation Plan

Source of truth: [design.md](./design.md). Section refs (§n) point there.

## 1. Organizing principle

The library is split **by kind of value being checked**, the same groups as §5. Each group is self-contained at two levels:

| Level   | What a group owns                                                                 | Combined into                     |
| ------- | --------------------------------------------------------------------------------- | --------------------------------- |
| Runtime | a `CheckGroup` object: `{ [key]: CheckDef }` (param validation, test, describe)   | `checks` registry (one object)    |
| Types   | a `XParams` interface (with JSDoc), `XNarrow<P>` and `XExact<P>` type functions   | `AffirmParams`, `Affirmed<V, P>`  |

The core engine knows nothing about specific keys. It only iterates the combined registry. Adding a key means touching exactly one group's runtime file and one group's types file.

Finally, three entry points (call, `explain`, `assert`) are combined into the single exported `affirm` object.

## 2. File layout

```
src/
  index.ts                     public exports only
  affirm.ts                    builds the exported `affirm` object (call + explain + assert)

  core/
    check-def.ts               CheckDef, CheckGroup, Phase, EvalContext types + leaf()/booleanLeaf() helpers
    registry.ts                merges all groups → `checks`; derives canonical key order
    evaluate.ts                runParams(value, params, ctx) — short-circuit or collect-all
    validate-params.ts         unknown key (+ "did you mean"), empty params, param-type errors
    report.ts                  AffirmReport, AffirmFailure, path formatting, reason sentences
    describe.ts                `received` descriptions (no raw values, §8)
    errors.ts                  AffirmError
    util/
      levenshtein.ts
      same-value-zero.ts
      deep-equal.ts            §7
      kind.ts                  isMeasurable, sizeOf, isPlainObject, isNumberNotNaN …
      standard-schema.ts       vendored StandardSchemaV1 types + sync runner (§10)

  checks/                      runtime, one file per group
    equality.ts                is, isNot, isOneOf, isNotOneOf, isDeepEqual
    nullish.ts                 isNull, isUndefined, isNullish, isDefined, isPresent, isTruthy, isFalsy
    runtime-type.ts            isType, isArray, isPlainObject, isFunction, isInstanceOf,
                               isValidDate, isInteger, isFiniteNumber, isNaN
    size.ts                    isEmpty, isNotEmpty, isBlank, hasLength, hasMinLength, hasMaxLength
    numbers.ts                 isGreaterThan, isAtLeast, isLessThan, isAtMost, isBetween,
                               isPositive, isNegative, isMultipleOf
    strings.ts                 startsWith, endsWith, includes, matches
    objects.ts                 hasKey, hasKeys, hasAnyKey, hasOnlyKeys, hasPath, shape
    arrays.ts                  contains, containsAll, containsAny, everyItem, someItem
    composition.ts             not, anyOf, satisfies

  types/                       type level, mirrors checks/ one-to-one
    equality.ts                EqualityParams, EqualityNarrow<P>, EqualityExact<P>
    nullish.ts                 …
    runtime-type.ts
    size.ts
    numbers.ts
    strings.ts
    objects.ts                 includes PathToType<'a.b.0.c'>
    arrays.ts
    composition.ts
    params.ts                  AffirmParams = combined interface
    affirmed.ts                Affirmed<V, P>, Refined brand, Simplify
    contradictions.ts          NoContradictions<P> (§6.4)
    affirm-interface.ts        the `Affirm` call-signature interface (§6.1)

test/
  runtime/<group>.test.ts      one per group + engine/report/error tests
  types/<group>.test-d.ts      narrowing tests per group + asserted.test-d.ts (M2 gate)
```

## 3. Runtime: the per-group contract

```ts
// core/check-def.ts
export const enum Phase { Kind = 0, Measure = 1, Structural = 2, Predicate = 3 } // §4 rule 7

export interface EvalContext {
  path: string
  mode: 'first' | 'all'                      // affirm() vs explain()
  run(value: unknown, params: AffirmParams, path: string): AffirmFailure[] // recursion for composites
}

export interface CheckDef<Param> {
  phase: Phase
  /** Programmer-error guard (§4 rule 6). Returns an error message or undefined. */
  validateParam(param: unknown): string | undefined
  /** Optional kind gate: if it fails, ONE failure is produced and test() is not called (§4 rules 5, 7). */
  accepts?: (value: unknown) => boolean
  acceptsLabel?: string                      // e.g. 'a number', 'measurable'
  /** Returns [] on pass. Leaves get this from leaf()/booleanLeaf(); composites implement it directly. */
  evaluate(value: unknown, param: Param, ctx: EvalContext): AffirmFailure[]
}

export type CheckGroup<P> = { readonly [K in keyof Required<P>]-?: CheckDef<NonNullable<P[K]>> }
```

Helpers so most keys are 3–5 lines:

- `leaf({ phase, validateParam, accepts?, test, expected })` — wraps a `(value, param) => boolean` into `evaluate`.
- `booleanLeaf({ phase, accepts?, test, expected, expectedNot })` — implements D1 once: pass ⇔ `test(value) === param`, and produces `expected: 'not null'` wording for `false`.

Each group file looks like:

```ts
// checks/numbers.ts
export const numberChecks = {
  isGreaterThan: leaf({ phase: Phase.Measure, validateParam: finiteNumber, accepts: isNumberNotNaN,
                        test: (v, n) => v > n, expected: n => `> ${n}` }),
  isPositive:    booleanLeaf({ phase: Phase.Measure, accepts: isNumberNotNaN,
                               test: v => v > 0, expected: '> 0', expectedNot: '<= 0' }),
  …
} satisfies CheckGroup<NumberParams>
```

`satisfies CheckGroup<NumberParams>` ties runtime to types: a key in the interface without an implementation (or vice versa) is a compile error inside that group.

## 4. Combining: the registry

```ts
// core/registry.ts
export const checks = defineRegistry(
  equalityChecks, nullishChecks, runtimeTypeChecks, sizeChecks,
  numberChecks, stringChecks, objectChecks, arrayChecks, compositionChecks,
) satisfies CheckGroup<AffirmParams>

export const KEY_ORDER: readonly (keyof AffirmParams)[] = /* keys sorted by phase, stable within phase */
```

`defineRegistry(...groups)`:
- merges with spread, but **throws at module load on a duplicate key** (a plain spread would silently overwrite);
- is typed to return the intersection, plus a type-level `Disjoint<…>` check so collisions also fail `tsc`.

`KEY_ORDER` is computed once; `evaluate.ts` walks it rather than `Object.keys(params)` (§4 rule 7).

## 5. Types: combining the per-group params and narrowing

```ts
// types/params.ts
export interface AffirmParams
  extends EqualityParams, NullishParams, RuntimeTypeParams, SizeParams,
          NumberParams, StringParams, ObjectParams, ArrayParams, CompositionParams {}
```

`interface … extends` (not `&`) gives better hover output and errors on conflicting key types between groups.

Narrowing is combined the same way:

```ts
// types/affirmed.ts
type Narrow<P> = EqualityNarrow<P> & NullishNarrow<P> & RuntimeTypeNarrow<P> & SizeNarrow<P>
               & NumberNarrow<P> & StringNarrow<P> & ObjectNarrow<P> & ArrayNarrow<P> & CompositionNarrow<P>

type IsExact<P> = /* true iff every present key is exact per its group's XExact<P> (§6.3) */

export type Affirmed<V, P> = IsExact<P> extends true
  ? Simplify<V & Narrow<P>>
  : Simplify<V & Narrow<P>> & Refined
```

Each `XNarrow<P>` returns `unknown` for keys it doesn't own, so the intersection is neutral. Each `XExact<P>` returns `true` when none of its keys are present. Recursive keys (`shape`, `everyItem`, `someItem`, `anyOf`, `not`) import `Affirmed` from `affirmed.ts` — the one intentional cycle, type-only.

## 6. Combining: the exported `affirm` object

```ts
// affirm.ts
function call(value: unknown, params: AffirmParams): boolean {
  validateParams(params)                        // throws TypeError
  return runParams(value, params, 'first').length === 0
}
function explain(value: unknown, params: AffirmParams): AffirmReport { … 'all' … }
function assertOrThrow(value: unknown, params: AffirmParams, message?: string): void {
  const report = explain(value, params)
  if (!report.ok) throw new AffirmError(report, message)
}

export const affirm: Affirm = Object.assign(call, { explain, assert: assertOrThrow })
```

`Affirm` is the explicit interface from §6.1; the explicit annotation is what lets `affirm.assert` carry an `asserts` signature.

```ts
// index.ts
export { affirm } from './affirm'
export { AffirmError } from './core/errors'
export type { AffirmParams } from './types/params'
export type { AffirmReport, AffirmFailure } from './core/report'
export type { Affirmed } from './types/asserted'
```

## 7. Milestones

| #  | Scope | Done when |
| -- | ----- | --------- |
| M0 ✅ | Vite scaffold turned into a library: template files deleted; `vite build` lib mode (ESM) + `tsc -p tsconfig.build.json` for `.d.ts`; vitest with typecheck for `test/**/*.test-d.ts`; tsconfig `strict` + `noUncheckedIndexedAccess`, no DOM/vite types. Smoke tests in `test/smoke.*` (delete in M1). | `pnpm build` emits `dist/index.js` + `dist/index.d.ts`; `pnpm test` runs runtime + type tests |
| M1 ✅ | `core/*` engine + `equality`, `nullish`, `runtime-type` groups (runtime only). `validate-params` with levenshtein suggestion. | runtime tests for those groups, rule 3–6 tests, canonical order test |
| M2 | **Type spike / gate (§6.3).** `types/` for M1 groups, `Refined` brand, `Affirmed`, `Affirm` interface. Tests (a)–(e). | All five pass on the installed TS (`~7.0`), or fallback chosen and recorded in design §6.3 |
| M3 | Remaining leaf groups: `size`, `numbers`, `strings`, `objects` (minus `shape`), `arrays` (minus `everyItem`/`someItem`) — runtime + types per group. | per-group runtime + type tests |
| M4 | Composites: `shape`, `everyItem`, `someItem`, `not`, `anyOf` (with `branches`), `satisfies`; `deep-equal`; `explain` report paths (`user.address.zip`, `items[2].id`); `AffirmError` message. | report snapshot tests; no raw values in any `received` |
| M5 | Standard Schema in `isType` (§10), async → `TypeError`. `NoContradictions<P>` (§6.4). | tests with a hand-rolled sync + async Standard Schema object (no Zod dep) |
| M6 | Docs contract (§11): JSDoc + `@example` on every key in each `types/<group>.ts`; write `AGENTS.md` (referenced by §11 but not in the repo yet). JSDoc for `isFunction` and `isType: 'function'` must say classes pass and calling one without `new` throws. | a test that every `AffirmParams` key has JSDoc (scan the .ts source) |

**M1 notes**
- Pulled forward from M4 because M1 needed them: `deep-equal.ts` (for `isDeepEqual`), `AffirmError` and `affirm.assert`.
- `affirm.ts` uses a provisional, non-narrowing `Affirm` interface; M2 replaces it with the §6.1 one.
- `isType` rejects Standard Schema objects with a "not implemented yet (M5)" `TypeError`.
- `EvalContext` carries `key`, so `CheckDef` doesn't need `accepts`/`acceptsLabel` fields; the kind gate lives in `leaf()`/`booleanLeaf()`.
- Behaviour choices awaiting confirmation:
  - Params whose keys are all `undefined` (e.g. `{ isNull: undefined }`) pass; only a literal `{}` throws.
  - `expected` shows short param literals (`=== "admin"`, strings ≤ 32 chars); D5 is read as covering `received` (data), not params (code).
  - An `isType` guard passes only when it returns exactly `true`.

Within every milestone, work group-by-group: `types/<group>.ts` → `checks/<group>.ts` (`satisfies` keeps them in sync) → tests.

## 8. Tests that guard the combination

- **Registry ⇔ types parity**: `satisfies CheckGroup<AffirmParams>` (compile time) plus a runtime test that `Object.keys(checks).sort()` equals a hard-coded list.
- **No duplicate keys across groups**: `defineRegistry` throws; test it with two fake groups.
- **Order**: a spy-based test that `isType` runs before `hasMinLength` runs before `shape` runs before `satisfies`, regardless of param object key order.
- **Kind gate**: `hasMinLength: 3` on a number yields exactly one failure (`not measurable`); `shape` on a string yields one failure, not one per field.

## 9. Decisions (resolved)

1. **Boolean kind-gated keys with `false`** (design D7): the kind gate wins. Wrong kind fails for both polarities (`isPositive: false` means "a number that is not positive"). `booleanLeaf()` runs `accepts` before applying D1. Applies to `isPositive`, `isNegative`, `isBlank`, `isInteger`, `isFiniteNumber`, `isNaN`, `isValidDate`, `isEmpty`/`isNotEmpty`.
2. **Naming**: exported types/classes are PascalCase with the `Affirm` prefix: `AffirmError`, `AffirmParams`, `AffirmReport`, `AffirmFailure`, `Affirmed<V, P>`, and the call-signature interface `Affirm`. The runtime function is `affirm()`, with methods `affirm.explain` and `affirm.assert`.
3. **Package name** stays `assert`, private, local use only (Q1).

## 10. Deferred (v1.1) — reminders

- **Q2 `Object.create(null)` objects**: covered by `Object.hasOwn` + a test in M3. Revisit if `hasPath`/`shape` or `isPlainObject` interactions get awkward.
- **Q3 `bigint`** for number keys: `numbers.ts` `accepts` becomes `number | bigint`; types widen. Keep number helpers in `core/util/kind.ts` so this is a one-file change.
- **Q4 `affirm.is(params)`** curried guard: becomes a fourth member in the `Object.assign` in `affirm.ts`; needs its own section in design.md (signature, narrowing via `(v: unknown) => v is Affirmed<unknown, P>`, `.filter` example) before implementation.

# @frankmeza/affirm

Runtime checks that read like a spec. `affirm(value, params)` replaces a compound `if` with one object of named checks. It returns a boolean and narrows `value`'s type.

Before: what is this actually checking?

```ts
function getTotal(order: unknown): number | undefined {
  if (
    typeof order === "object" &&
    order !== null &&
    Object.hasOwn(order, "total") && // own key only: ignores inherited properties
    "total" in order && // repeated so TypeScript narrows `order.total`
    typeof order.total === "number" &&
    order.total > 0
  ) {
    return order.total // number
  }
  return undefined
}
```

After:

```ts
import { affirm } from "@frankmeza/affirm"

// a non-null object with an own key `total`,
// and `total` is a number greater than 0.
const affirmIsNonZeroPositiveNumber = {
  shape: {
    total: { isType: "number", isPositive: true },
  },
} as const

function getTotal(order: unknown): number | undefined {
  if (affirm(order, affirmIsNonZeroPositiveNumber)) {
    return order.total // number
  }

  return undefined
}
```

## Why

More and more code is written by coding agents and read by people in pull requests. Hand-rolled checks are where intent gets lost. `x && x.length > 0 && !/^\s*$/.test(x)` takes a reviewer a moment to decode, and a subtle mistake in it (`>=` instead of `>`, a missing `typeof`) is easy to miss.

With `affirm`, every condition is a named key (`isBlank: false`, `hasMinLength: 3`, `isBetween: [1, 10]`), so a reviewer can read what the code requires and judge whether that's the right requirement. Behind that:

- **TypeScript narrowing.** Exact checks narrow both branches; the others narrow the `if` branch. Contradictory params, such as `isNull: true` with `isPresent: true`, are compile errors.
- **Failure reports.** `affirm.explain` lists every failure with its path (`items[2].id: expected length >= 3, received string(len 2)`). Reports never include the values being checked.
- **Built for agents.** The package ships an [`AGENTS.md`](AGENTS.md) usage guide for coding agents, and every key has hover docs with its exact pass condition.
- **An ESLint plugin** that catches the mistakes TypeScript can't, such as negated checks and params that lose their literal types.
- **No runtime dependencies.** Works with Zod, Valibot and ArkType schemas through [Standard Schema](https://standardschema.dev).

`affirm` checks values. It doesn't parse or transform them: no coercion, defaults or trimming. Use a schema library for that, and pass the schema to `affirm` as `isType`.

## Install

```sh
npm install @frankmeza/affirm
```

Requires **TypeScript 5.9 or later** with `strictNullChecks` (or `strict`). On older versions narrowing silently breaks: every `else` branch becomes `never`.

## Usage

```ts
import { affirm, AffirmError } from '@frankmeza/affirm'

affirm(value, params)                   // boolean; narrows `value` in the if-branch
affirm.explain(value, params)           // { ok, failures }: every failure, with paths
affirm.assert(value, params, message?)  // throws AffirmError on failure; narrows afterwards
```

```ts
// Present, non-empty string
affirm(name, { isType: "string", isBlank: false })

// Enum
affirm(status, { isOneOf: ["draft", "published", "archived"] })

// Array of objects
affirm(order.items, {
  isNotEmpty: true,
  everyItem: {
    shape: { sku: { isBlank: false }, qty: { isInteger: true, isAtLeast: 1 } },
  },
})

// OR
affirm(input, { anyOf: [{ isNullish: true }, { isEmpty: true }] })

// An existing schema
affirm(body, { isType: OrderSchema })

// Config at startup: throw with a clear message
affirm.assert(
  env.PORT,
  { isType: "string", matches: /^\d+$/ },
  "PORT must be numeric",
)

// Explain why a request body failed
const report = affirm.explain(body, { shape: { email: { matches: /@/ } } })
if (!report.ok) return badRequest(report.failures.map((f) => f.reason))
```

Keys combine with AND, an omitted or `undefined` key is skipped, and there's no coercion: `isGreaterThan: 5` fails on `'10'`. Mistakes in the params themselves, such as an unknown key or an empty `{}`, throw a `TypeError` that says how to fix them (an unknown key gets a "did you mean" hint), so they can't pass silently.

| Group        | Keys                                                                                                                      |
| ------------ | ------------------------------------------------------------------------------------------------------------------------- |
| Equality     | `is`, `isNot`, `isOneOf`, `isNotOneOf`, `isDeepEqual`                                                                     |
| Nullish      | `isNull`, `isUndefined`, `isNullish`, `isDefined`, `isPresent`, `isTruthy`, `isFalsy`                                     |
| Runtime type | `isType`, `isArray`, `isPlainObject`, `isFunction`, `isInstanceOf`, `isValidDate`, `isInteger`, `isFiniteNumber`, `isNaN` |
| Size         | `isEmpty`, `isNotEmpty`, `isBlank`, `hasLength`, `hasMinLength`, `hasMaxLength`                                           |
| Numbers      | `isGreaterThan`, `isAtLeast`, `isLessThan`, `isAtMost`, `isBetween`, `isPositive`, `isNegative`, `isMultipleOf`           |
| Strings      | `startsWith`, `endsWith`, `includes`, `matches`                                                                           |
| Objects      | `shape`, `hasKey`, `hasKeys`, `hasAnyKey`, `hasOnlyKeys`, `hasPath`                                                       |
| Arrays       | `contains`, `containsAll`, `containsAny`, `everyItem`, `someItem`                                                         |
| Composition  | `not`, `anyOf`, `satisfies`                                                                                               |

## ESLint plugin

```js
// eslint.config.js
import affirm from "@frankmeza/affirm/eslint"

export default [
  affirm.configs.recommended,
  { settings: { affirm: { guards: "^isValid" } } },
]
```

| Rule                       | Catches                                                                                                                                                                                                                |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `affirm/no-negated-affirm` | `!affirm(…)` and negated guards. `affirm` is an AND of narrow checks, so its negation only means "something failed", which is too broad to act on. Use `affirm.assert`, `affirm.explain`, or a positive check instead. |
| `affirm/guard-naming`      | Guards built on `affirm` that don't follow the `guards` naming pattern, which is how negated guards are caught across files.                                                                                           |
| `affirm/const-params`      | Params stored in a variable without `as const`, which lose their literal types before `affirm` sees them. Autofixable.                                                                                                 |

Requires ESLint 9 or 10 with a flat config. `eslint` is an optional peer dependency.

## Docs

- [`AGENTS.md`](AGENTS.md): the short guide for coding agents. Point your agent at it, for example from your own `AGENTS.md` or `CLAUDE.md`.
- [`docs/client-usage.md`](docs/client-usage.md): the full guide, with recipes, the report format, a narrowing table, pitfalls that compile but are wrong, and a checklist for reviewing generated code.

Both files ship in the package, so they're available under `node_modules/@frankmeza/affirm/`.

## License

[MIT](LICENSE)

import {
  composite,
  leaf,
  Phase,
  propertyKeyListParam,
  propertyKeyParam,
  type CheckGroup,
  type ValidateNested,
} from '../core/check-def.js'
import { formatList, formatParam } from '../core/describe.js'
import { joinPath, type AffirmFailure } from '../core/report.js'
import { isObjectLike, isPlainObject, ownKeys } from '../core/util/kind.js'
import type { ObjectParams } from '../types/objects.js'
import type { AffirmParams } from '../types/params.js'

const OBJECT = 'an object or array'

/** Own-key comparison treats `0` and `'0'` as the same key, like property access does. */
const normalizeKey = (key: PropertyKey): string | symbol => (typeof key === 'symbol' ? key : String(key))

function validatePath(param: unknown): string | undefined {
  if (typeof param !== 'string') return `a dot path string (received ${formatParam(param)})`
  if (param.split('.').some((segment) => segment === '')) {
    return `a dot path with no empty segments (received ${formatParam(param)})`
  }
  return undefined
}

function hasOwnPath(value: object, path: string): boolean {
  let current: unknown = value
  for (const segment of path.split('.')) {
    if (!isObjectLike(current) || !Object.hasOwn(current, segment)) return false
    current = (current as Record<string, unknown>)[segment]
  }
  return true
}

function validateShape(param: unknown, path: string, validateNested: ValidateNested): string | undefined {
  if (!isPlainObject(param)) return `an object mapping field names to params (received ${formatParam(param)})`
  if (Object.keys(param).length === 0) return 'at least one field; `shape: {}` would always pass'
  for (const [field, fieldParams] of Object.entries(param)) validateNested(fieldParams, joinPath(path, field))
  return undefined
}

const shapeCheck = composite<Readonly<Record<string, AffirmParams>>, object>({
  phase: Phase.Structural,
  validateParam: validateShape,
  accepts: isObjectLike,
  acceptsLabel: OBJECT,
  evaluate(value, shape, ctx) {
    const failures: AffirmFailure[] = []
    for (const [field, fieldParams] of Object.entries(shape)) {
      // Own-key semantics (D2): a missing or inherited field is checked as `undefined`.
      const fieldValue = Object.hasOwn(value, field) ? (value as Record<string, unknown>)[field] : undefined
      failures.push(...ctx.run(fieldValue, fieldParams, joinPath(ctx.path, field)))
      if (ctx.mode === 'first' && failures.length > 0) break
    }
    return failures
  },
})

export const objectChecks = {
  shape: shapeCheck,

  hasKey: leaf<PropertyKey, object>({
    phase: Phase.Measure,
    validateParam: propertyKeyParam,
    accepts: isObjectLike,
    acceptsLabel: OBJECT,
    test: (value, key) => Object.hasOwn(value, key),
    expected: (key) => `own key ${formatParam(key)}`,
  }),

  hasKeys: leaf<readonly PropertyKey[], object>({
    phase: Phase.Measure,
    validateParam: propertyKeyListParam,
    accepts: isObjectLike,
    acceptsLabel: OBJECT,
    test: (value, keys) => keys.every((key) => Object.hasOwn(value, key)),
    expected: (keys) => `own keys ${formatList(keys)}`,
  }),

  hasAnyKey: leaf<readonly PropertyKey[], object>({
    phase: Phase.Measure,
    validateParam: propertyKeyListParam,
    accepts: isObjectLike,
    acceptsLabel: OBJECT,
    test: (value, keys) => keys.some((key) => Object.hasOwn(value, key)),
    expected: (keys) => `at least one own key of ${formatList(keys)}`,
  }),

  hasOnlyKeys: leaf<readonly PropertyKey[], object>({
    phase: Phase.Measure,
    validateParam: propertyKeyListParam,
    accepts: isObjectLike,
    acceptsLabel: OBJECT,
    test: (value, keys) => {
      const allowed = new Set(keys.map(normalizeKey))
      return ownKeys(value).every((key) => allowed.has(normalizeKey(key)))
    },
    expected: (keys) => `no own keys other than ${formatList(keys)}`,
  }),

  hasPath: leaf<string, object>({
    phase: Phase.Measure,
    validateParam: validatePath,
    accepts: isObjectLike,
    acceptsLabel: OBJECT,
    test: hasOwnPath,
    expected: (path) => `own path ${formatParam(path)}`,
  }),
} satisfies CheckGroup<ObjectParams>

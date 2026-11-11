import { booleanLeaf, leaf, Phase, type CheckDef, type CheckGroup, type EvalContext } from '../core/check-def'
import { formatParam } from '../core/describe'
import { joinPath, makeFailure, type AffirmFailure } from '../core/report'
import { isDate, isNumber, isPlainObject, looksLikeConstructor } from '../core/util/kind'
import { isStandardSchema, validateSync, type StandardSchemaV1 } from '../core/util/standard-schema'
import type { RuntimeTypeParams, TypeGuard, TypeTag } from '../types/runtime-type'

const TYPE_TAGS: ReadonlySet<string> = new Set<TypeTag>([
  'string',
  'number',
  'boolean',
  'bigint',
  'symbol',
  'function',
  'object',
])

function validateIsType(param: unknown): string | undefined {
  // Schemas first: ArkType schemas are callable, and would otherwise be taken for guards.
  if (isStandardSchema(param)) return undefined
  if (typeof param === 'string') {
    if (TYPE_TAGS.has(param)) return undefined
    if (param === 'undefined') return `a type tag; use \`isUndefined: true\` instead of \`isType: 'undefined'\``
    if (param === 'null') return `a type tag; use \`isNull: true\` instead of \`isType: 'null'\``
    return `one of ${[...TYPE_TAGS].map((t) => `'${t}'`).join(', ')} (received ${formatParam(param)})`
  }
  if (typeof param === 'function') {
    if (looksLikeConstructor(param)) {
      return `a type tag, guard or schema; use \`isInstanceOf: ${param.name || 'YourClass'}\` for classes`
    }
    return undefined
  }
  return `a type tag, a type guard function or a Standard Schema (received ${formatParam(param)})`
}

function matchesTag(value: unknown, tag: TypeTag): boolean {
  if (tag === 'object') return typeof value === 'object' && value !== null
  return typeof value === tag
}

type PathSegment = PropertyKey | StandardSchemaV1.PathSegment

const segmentKey = (segment: PathSegment): PropertyKey =>
  typeof segment === 'object' && segment !== null ? segment.key : segment

/** Appends a schema issue path: numbers as `[n]`, strings as `.key`, symbols as `[Symbol(x)]`. */
function appendIssuePath(base: string, path: readonly PathSegment[] | undefined): string {
  let out = base
  for (const segment of path ?? []) {
    const key = segmentKey(segment)
    out = typeof key === 'symbol' ? `${out}[${key.toString()}]` : joinPath(out, key)
  }
  return out
}

/** The value an issue points at, for `received` (described by type only, D5). */
function valueAt(value: unknown, path: readonly PathSegment[] | undefined): unknown {
  let current = value
  for (const segment of path ?? []) {
    if ((typeof current !== 'object' && typeof current !== 'function') || current === null) return undefined
    current = (current as Record<PropertyKey, unknown>)[segmentKey(segment)]
  }
  return current
}

/**
 * Maps schema issues to failures (design §10). Issue *messages* are not copied: libraries may put
 * the received value in them (e.g. enum mismatches), and reports must not carry raw values (D5).
 */
function schemaFailures(schema: StandardSchemaV1, value: unknown, ctx: EvalContext): AffirmFailure[] {
  const result = validateSync(schema, value)
  if (result.issues === undefined) return []
  const vendor = schema['~standard'].vendor
  if (result.issues.length === 0) return [makeFailure(ctx.key, ctx.path, `a value accepted by the ${vendor} schema`, value)]
  return result.issues.map((issue) =>
    makeFailure(
      ctx.key,
      appendIssuePath(ctx.path, issue.path),
      `a value accepted by the ${vendor} schema`,
      valueAt(value, issue.path),
    ),
  )
}

const isTypeCheck: CheckDef<TypeTag | TypeGuard | StandardSchemaV1> = {
  phase: Phase.Kind,
  validateParam: validateIsType,
  evaluate(value, param, ctx) {
    if (isStandardSchema(param)) return schemaFailures(param, value, ctx)
    if (typeof param === 'string') {
      if (matchesTag(value, param)) return []
      return [makeFailure(ctx.key, ctx.path, param === 'object' ? 'a non-null object' : `typeof ${param}`, value)]
    }
    if (param(value) === true) return []
    return [makeFailure(ctx.key, ctx.path, `${param.name || 'guard'}(value) to return true`, value)]
  },
}

export const runtimeTypeChecks = {
  isType: isTypeCheck,

  isArray: booleanLeaf({
    phase: Phase.Kind,
    test: (value) => Array.isArray(value),
    expected: 'an array',
    expectedNot: 'not an array',
  }),

  isPlainObject: booleanLeaf({
    phase: Phase.Kind,
    test: isPlainObject,
    expected: 'a plain object',
    expectedNot: 'not a plain object',
  }),

  isFunction: booleanLeaf({
    phase: Phase.Kind,
    test: (value) => typeof value === 'function',
    expected: 'a function',
    expectedNot: 'not a function',
  }),

  isInstanceOf: leaf<abstract new (...args: any) => any>({
    phase: Phase.Kind,
    validateParam: (param) =>
      typeof param === 'function' && param.prototype !== undefined
        ? undefined
        : `a class or constructor (received ${formatParam(param)})`,
    test: (value, ctor) => value instanceof ctor,
    expected: (ctor) => `instance of ${ctor.name || 'the given class'}`,
  }),

  isValidDate: booleanLeaf<Date>({
    phase: Phase.Kind,
    accepts: isDate,
    acceptsLabel: 'a Date',
    test: (date) => !Number.isNaN(date.getTime()),
    expected: 'a valid Date',
    expectedNot: 'an invalid Date',
  }),

  isInteger: booleanLeaf<number>({
    phase: Phase.Kind,
    accepts: isNumber,
    acceptsLabel: 'a number',
    test: Number.isInteger,
    expected: 'an integer',
    expectedNot: 'a non-integer number',
  }),

  isFiniteNumber: booleanLeaf<number>({
    phase: Phase.Kind,
    accepts: isNumber,
    acceptsLabel: 'a number',
    test: Number.isFinite,
    expected: 'a finite number',
    expectedNot: 'a non-finite number (Infinity, -Infinity or NaN)',
  }),

  isNaN: booleanLeaf<number>({
    phase: Phase.Kind,
    accepts: isNumber,
    acceptsLabel: 'a number',
    test: Number.isNaN,
    expected: 'NaN',
    expectedNot: 'a number other than NaN',
  }),
} satisfies CheckGroup<RuntimeTypeParams>

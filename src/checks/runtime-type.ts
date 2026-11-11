import { booleanLeaf, leaf, Phase, type CheckGroup } from '../core/check-def'
import { formatParam } from '../core/describe'
import { isDate, isNumber, isPlainObject, looksLikeConstructor } from '../core/util/kind'
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
  if (typeof param === 'string') {
    if (TYPE_TAGS.has(param)) return undefined
    if (param === 'undefined') return `a type tag; use \`isUndefined: true\` instead of \`isType: 'undefined'\``
    if (param === 'null') return `a type tag; use \`isNull: true\` instead of \`isType: 'null'\``
    return `one of ${[...TYPE_TAGS].map((t) => `'${t}'`).join(', ')} (received ${formatParam(param)})`
  }
  if (typeof param === 'function') {
    if (looksLikeConstructor(param)) {
      return `a type tag or guard; use \`isInstanceOf: ${param.name || 'YourClass'}\` for classes`
    }
    return undefined
  }
  if (typeof param === 'object' && param !== null && '~standard' in param) {
    return 'a type tag or guard; Standard Schema support is not implemented yet (M5)'
  }
  return `a type tag or a type guard function (received ${formatParam(param)})`
}

function matchesTag(value: unknown, tag: TypeTag): boolean {
  if (tag === 'object') return typeof value === 'object' && value !== null
  return typeof value === tag
}

export const runtimeTypeChecks = {
  isType: leaf<TypeTag | TypeGuard>({
    phase: Phase.Kind,
    validateParam: validateIsType,
    test: (value, param) => (typeof param === 'string' ? matchesTag(value, param) : param(value) === true),
    expected: (param) => {
      if (typeof param === 'function') return `${param.name || 'guard'}(value) to return true`
      return param === 'object' ? 'a non-null object' : `typeof ${param}`
    },
  }),

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

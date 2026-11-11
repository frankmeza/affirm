/** Prototype is `Object.prototype` or `null` (so `Object.create(null)` counts, design Q2). */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false
  const proto: unknown = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

export function isNumber(value: unknown): value is number {
  return typeof value === 'number'
}

export function isDate(value: unknown): value is Date {
  return value instanceof Date
}

/**
 * Heuristic for "this is a class/constructor, not a guard function" so `isType: Date`
 * can be rejected with "use isInstanceOf". Catches `class` syntax and capitalised built-ins
 * (`Date`, `Map`, `Error`, …). Arrow functions and lowercase function declarations pass.
 */
export function looksLikeConstructor(fn: Function): boolean {
  const source = Function.prototype.toString.call(fn)
  if (/^class[\s{]/.test(source)) return true
  return /\{\s*\[native code\]\s*\}\s*$/.test(source) && /^[A-Z]/.test(fn.name)
}

/** A number other than NaN: the kind gate for every number key (design §5 "Numbers"). */
export function isNumberNotNaN(value: unknown): value is number {
  return typeof value === 'number' && !Number.isNaN(value)
}

export function isString(value: unknown): value is string {
  return typeof value === 'string'
}

/** Non-null object or array (functions excluded): the kind gate for object keys. */
export function isObjectLike(value: unknown): value is object {
  return typeof value === 'object' && value !== null
}

export function isArray(value: unknown): value is readonly unknown[] {
  return Array.isArray(value)
}

export type Measurable = string | readonly unknown[] | ReadonlyMap<unknown, unknown> | ReadonlySet<unknown>

/** "Measurable" = string, array, Map, Set (design §5 "Emptiness & size"). */
export function isMeasurable(value: unknown): value is Measurable {
  return typeof value === 'string' || Array.isArray(value) || value instanceof Map || value instanceof Set
}

export function sizeOf(value: Measurable): number {
  return typeof value === 'string' || Array.isArray(value) ? value.length : (value as ReadonlySet<unknown>).size
}

/** Own enumerable keys, string and symbol. */
export function ownKeys(value: object): PropertyKey[] {
  return [
    ...Object.keys(value),
    ...Object.getOwnPropertySymbols(value).filter((s) => Object.prototype.propertyIsEnumerable.call(value, s)),
  ]
}

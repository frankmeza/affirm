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

import { isPlainObject } from './kind.js'

/**
 * Structural equality per design §7.
 * - primitives: `Object.is`, except `+0` equals `-0`
 * - arrays: same length, elementwise
 * - plain objects: same own enumerable string keys, valuewise
 * - Date: same time · RegExp: same source + flags
 * - Map: same size, same keys (SameValueZero), values deep-equal
 * - Set: same size, every member present (SameValueZero; no deep matching of members)
 * - other class instances: reference equality only
 * - cycles: a pair already under comparison counts as equal
 */
export function deepEqual(a: unknown, b: unknown): boolean {
  return eq(a, b, new Map())
}

function eq(a: unknown, b: unknown, seen: Map<object, Set<object>>): boolean {
  if (a === b || Object.is(a, b)) return true
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false

  let partners = seen.get(a)
  if (partners?.has(b)) return true
  if (partners === undefined) seen.set(a, (partners = new Set()))
  partners.add(b)

  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false
    return a.every((item, i) => eq(item, b[i], seen))
  }
  if (isPlainObject(a) || isPlainObject(b)) {
    if (!isPlainObject(a) || !isPlainObject(b)) return false
    const keys = Object.keys(a)
    if (keys.length !== Object.keys(b).length) return false
    return keys.every((key) => Object.hasOwn(b, key) && eq(a[key], b[key], seen))
  }
  if (Object.getPrototypeOf(a) !== Object.getPrototypeOf(b)) return false
  if (a instanceof Date) return Object.is(a.getTime(), (b as Date).getTime())
  if (a instanceof RegExp) return a.source === (b as RegExp).source && a.flags === (b as RegExp).flags
  if (a instanceof Map) {
    const bm = b as Map<unknown, unknown>
    if (a.size !== bm.size) return false
    for (const [key, value] of a) {
      if (!bm.has(key) || !eq(value, bm.get(key), seen)) return false
    }
    return true
  }
  if (a instanceof Set) {
    const bs = b as Set<unknown>
    if (a.size !== bs.size) return false
    for (const member of a) if (!bs.has(member)) return false
    return true
  }
  return false
}

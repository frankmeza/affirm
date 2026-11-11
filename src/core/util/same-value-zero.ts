/**
 * SameValueZero: like `===`, but `NaN` equals `NaN` (design §4 rule 8).
 * `Array.prototype.includes`, `Map` and `Set` already use it; this is for the remaining cases.
 */
export function sameValueZero(a: unknown, b: unknown): boolean {
  return a === b || (a !== a && b !== b)
}

// Narrowing (RuntimeTypeNarrow / RuntimeTypeExact) lands in M2. Full JSDoc + @example in M6.
// Standard Schema support for `isType` lands in M5.

export type TypeTag = 'string' | 'number' | 'boolean' | 'bigint' | 'symbol' | 'function' | 'object'

/** A user type guard, e.g. `(v: unknown): v is User => …`. */
export type TypeGuard<T = unknown> = (value: unknown) => value is T

export interface RuntimeTypeParams {
  /**
   * A `typeof` tag (`'object'` excludes `null`, includes arrays) or a type guard.
   * Not `'null'`/`'undefined'` (use `isNull`/`isUndefined`); not a class (use `isInstanceOf`).
   */
  isType?: TypeTag | TypeGuard
  /** `true`: `Array.isArray(value)`. */
  isArray?: boolean
  /** `true`: prototype is `Object.prototype` or `null`. */
  isPlainObject?: boolean
  /** `true`: `typeof value === 'function'`. */
  isFunction?: boolean
  /** Passes when `value instanceof param`. */
  isInstanceOf?: abstract new (...args: any) => any
  /** `true`: a `Date` with a valid time. `false`: an invalid `Date`. Non-Dates fail both (D7). */
  isValidDate?: boolean
  /** `true`: `Number.isInteger(value)`. Non-numbers fail both polarities (D7). */
  isInteger?: boolean
  /** `true`: `Number.isFinite(value)`. Non-numbers fail both polarities (D7). */
  isFiniteNumber?: boolean
  /** `true`: `Number.isNaN(value)`. Non-numbers fail both polarities (D7). */
  isNaN?: boolean
}

// Narrowing (NullishNarrow / NullishExact) lands in M2. Full JSDoc + @example in M6.
// Boolean keys: `true` asserts, `false` asserts the negation (D1).

export interface NullishParams {
  /** `true`: value is `null`. `false`: value is not `null`. */
  isNull?: boolean
  /** `true`: value is `undefined`. `false`: value is not `undefined`. */
  isUndefined?: boolean
  /** `true`: value is `null` or `undefined`. `false`: value is neither. */
  isNullish?: boolean
  /** `true`: value is not `undefined` (`null` passes). `false`: value is `undefined`. */
  isDefined?: boolean
  /** `true`: value is neither `null` nor `undefined`. `false`: value is `null` or `undefined`. */
  isPresent?: boolean
  /** `true`: value is truthy. `false`: value is falsy. */
  isTruthy?: boolean
  /** `true`: value is falsy. `false`: value is truthy. */
  isFalsy?: boolean
}

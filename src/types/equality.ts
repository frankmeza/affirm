// Narrowing (EqualityNarrow / EqualityExact) lands in M2. Full JSDoc + @example in M6.

export interface EqualityParams {
  /** Passes when `value === param`. */
  is?: unknown
  /** Passes when `value !== param`. */
  isNot?: unknown
  /** Passes when the list includes the value (SameValueZero, so `NaN` matches `NaN`). */
  isOneOf?: readonly unknown[]
  /** Passes when the list does not include the value (SameValueZero). */
  isNotOneOf?: readonly unknown[]
  /** Passes when the value is structurally equal to the param (design §7). */
  isDeepEqual?: unknown
}

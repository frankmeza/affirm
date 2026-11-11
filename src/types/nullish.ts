// Full JSDoc + @example in M6.
// Boolean keys: `true` asserts, `false` asserts the negation (D1).
import type { BoolInfo, Exact, ParamOf, Refine } from './narrowing'

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

// Narrowing table: design §5 "Nullish & truthiness".
export type NullishInfos<P> = [
  BoolInfo<ParamOf<P, 'isNull'>, Exact<null>, Exact<{} | undefined>>,
  BoolInfo<ParamOf<P, 'isUndefined'>, Exact<undefined>, Exact<{} | null>>,
  BoolInfo<ParamOf<P, 'isNullish'>, Exact<null | undefined>, Exact<{}>>,
  BoolInfo<ParamOf<P, 'isDefined'>, Exact<{} | null>, Exact<undefined>>,
  BoolInfo<ParamOf<P, 'isPresent'>, Exact<{}>, Exact<null | undefined>>,
  BoolInfo<ParamOf<P, 'isTruthy'>, Refine<{}>, Refine>,
  BoolInfo<ParamOf<P, 'isFalsy'>, Refine, Refine<{}>>,
]

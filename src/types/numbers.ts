// Full JSDoc + @example in M6. Value must be a number other than NaN; bigint is v1.1 (Q3).
import type { BoolInfo, ParamInfo, ParamOf, Refine } from './narrowing'

export interface NumberParams {
  /** value > n */
  isGreaterThan?: number
  /** value >= n */
  isAtLeast?: number
  /** value < n */
  isLessThan?: number
  /** value <= n */
  isAtMost?: number
  /** min <= value <= max, inclusive at both ends (D3). */
  isBetween?: readonly [min: number, max: number]
  /** `true`: value > 0. `false`: value <= 0. Non-numbers fail both (D7). */
  isPositive?: boolean
  /** `true`: value < 0. `false`: value >= 0. Non-numbers fail both (D7). */
  isNegative?: boolean
  /** `value % n === 0`. n is a finite non-zero number. */
  isMultipleOf?: number
}

type NumberInfo<V> = ParamInfo<V, Refine<number>>
type NumberBool<V> = BoolInfo<V, Refine<number>, Refine<number>>

export type NumberInfos<P> = [
  NumberInfo<ParamOf<P, 'isGreaterThan'>>,
  NumberInfo<ParamOf<P, 'isAtLeast'>>,
  NumberInfo<ParamOf<P, 'isLessThan'>>,
  NumberInfo<ParamOf<P, 'isAtMost'>>,
  NumberInfo<ParamOf<P, 'isBetween'>>,
  NumberBool<ParamOf<P, 'isPositive'>>,
  NumberBool<ParamOf<P, 'isNegative'>>,
  NumberInfo<ParamOf<P, 'isMultipleOf'>>,
]

// Value must be a number other than NaN; bigint is v1.1 (Q3).
import type { BoolInfo, ParamInfo, ParamOf, Refine } from './narrowing.js'

export interface NumberParams {
  /**
   * Value is a number greater than n.
   *
   * Passes when the value is a number (not `NaN`) and `value > n`. No coercion: `'10'` fails.
   * Narrows to `number` (refined).
   *
   * @example
   * affirm(age, { isGreaterThan: 17 })
   */
  isGreaterThan?: number
  /**
   * Value is a number greater than or equal to n.
   *
   * Passes when the value is a number (not `NaN`) and `value >= n`. Narrows to `number` (refined).
   *
   * @example
   * affirm(quantity, { isInteger: true, isAtLeast: 1 })
   */
  isAtLeast?: number
  /**
   * Value is a number less than n.
   *
   * Passes when the value is a number (not `NaN`) and `value < n`. Narrows to `number` (refined).
   *
   * @example
   * affirm(discount, { isLessThan: 1 })
   */
  isLessThan?: number
  /**
   * Value is a number less than or equal to n.
   *
   * Passes when the value is a number (not `NaN`) and `value <= n`. Narrows to `number` (refined).
   *
   * @example
   * affirm(retries, { isAtMost: 5 })
   */
  isAtMost?: number
  /**
   * Value is a number between min and max, **inclusive at both ends**.
   *
   * Passes when the value is a number (not `NaN`) and `min <= value && value <= max`.
   * `min > max` throws. Narrows to `number` (refined).
   *
   * @example
   * affirm(rating, { isInteger: true, isBetween: [1, 5] }) // 1 and 5 pass
   */
  isBetween?: readonly [min: number, max: number]
  /**
   * Value is a positive number (`true`), or a number that is not positive (`false`).
   *
   * Passes when the value is a number (not `NaN`) and `(value > 0) === param`. `0` is not positive.
   * Non-numbers fail both polarities. Narrows to `number` (refined).
   *
   * @example
   * affirm(order.total, { isPositive: true })
   */
  isPositive?: boolean
  /**
   * Value is a negative number (`true`), or a number that is not negative (`false`).
   *
   * Passes when the value is a number (not `NaN`) and `(value < 0) === param`. `0` is not negative.
   * Non-numbers fail both polarities. Narrows to `number` (refined).
   *
   * @example
   * affirm(balance, { isNegative: false })
   */
  isNegative?: boolean
  /**
   * Value is a number that is a multiple of n.
   *
   * Passes when the value is a number (not `NaN`) and `value % n === 0`. n must be finite and
   * non-zero. Uses `%`, so fractional divisors are unreliable (`0.3 % 0.1 !== 0`): scale to
   * integers first. Narrows to `number` (refined).
   *
   * @example
   * affirm(minutes, { isMultipleOf: 15 })
   */
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

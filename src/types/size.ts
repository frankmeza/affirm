// Full JSDoc + @example in M6.
import type { Measurable } from '../core/util/kind'
import type { BoolInfo, ParamInfo, ParamOf, Refine } from './narrowing'

export interface SizeParams {
  /**
   * `true`: size is 0. `false`: size > 0. Works on strings, arrays, Maps, Sets and plain objects
   * (own enumerable keys). Anything else, including `null`, fails both (D7).
   */
  isEmpty?: boolean
  /** `true`: size > 0. `false`: size is 0. Same kinds as `isEmpty`. */
  isNotEmpty?: boolean
  /** `true`: a string whose `trim()` is `''`. `false`: a string with non-whitespace. Non-strings fail both. */
  isBlank?: boolean
  /** Size === n (string/array length, Map/Set size). n is a non-negative integer. */
  hasLength?: number
  /** Size >= n. */
  hasMinLength?: number
  /** Size <= n. */
  hasMaxLength?: number
}

type LengthInfo<V> = ParamInfo<V, Refine<Measurable>>

// Design §5: isEmpty/isNotEmpty don't narrow; isBlank → string; has*Length → Measurable. All refined.
export type SizeInfos<P> = [
  BoolInfo<ParamOf<P, 'isEmpty'>, Refine, Refine>,
  BoolInfo<ParamOf<P, 'isNotEmpty'>, Refine, Refine>,
  BoolInfo<ParamOf<P, 'isBlank'>, Refine<string>, Refine<string>>,
  LengthInfo<ParamOf<P, 'hasLength'>>,
  LengthInfo<ParamOf<P, 'hasMinLength'>>,
  LengthInfo<ParamOf<P, 'hasMaxLength'>>,
]

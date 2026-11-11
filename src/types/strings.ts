// Full JSDoc + @example in M6. Value must be a string.
import type { ParamInfo, ParamOf, Refine } from './narrowing'

export interface StringParams {
  /** `value.startsWith(param)` */
  startsWith?: string
  /** `value.endsWith(param)` */
  endsWith?: string
  /** `value.includes(param)`. Strings only; for arrays use `contains`. */
  includes?: string
  /** `param.test(value)`, with `lastIndex` reset first so `/g` and `/y` regexes are stateless. */
  matches?: RegExp
}

type StringInfo<V> = ParamInfo<V, Refine<string>>

export type StringInfos<P> = [
  StringInfo<ParamOf<P, 'startsWith'>>,
  StringInfo<ParamOf<P, 'endsWith'>>,
  StringInfo<ParamOf<P, 'includes'>>,
  StringInfo<ParamOf<P, 'matches'>>,
]

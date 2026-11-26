// Value must be a string.
import type { ParamInfo, ParamOf, Refine } from './narrowing.js'

export interface StringParams {
  /**
   * Value is a string starting with this prefix.
   *
   * Passes when the value is a string and `value.startsWith(param)`. Narrows to `string` (refined).
   *
   * @example
   * affirm(id, { startsWith: 'ord_' })
   */
  startsWith?: string
  /**
   * Value is a string ending with this suffix.
   *
   * Passes when the value is a string and `value.endsWith(param)`. Narrows to `string` (refined).
   *
   * @example
   * affirm(filename, { endsWith: '.csv' })
   */
  endsWith?: string
  /**
   * Value is a string containing this substring. Strings only: for array items use `contains`.
   *
   * Passes when the value is a string and `value.includes(param)`. Narrows to `string` (refined).
   *
   * @example
   * affirm(email, { includes: '@' })
   */
  includes?: string
  /**
   * Value is a string matching this regular expression.
   *
   * Passes when the value is a string and `param.test(value)`. `lastIndex` is reset first, so `/g`
   * and `/y` regexes give the same answer on every call. A string param throws (use `includes`).
   * Narrows to `string` (refined).
   *
   * @example
   * affirm(zip, { matches: /^\d{5}$/ })
   */
  matches?: RegExp
}

type StringInfo<V> = ParamInfo<V, Refine<string>>

export type StringInfos<P> = [
  StringInfo<ParamOf<P, 'startsWith'>>,
  StringInfo<ParamOf<P, 'endsWith'>>,
  StringInfo<ParamOf<P, 'includes'>>,
  StringInfo<ParamOf<P, 'matches'>>,
]

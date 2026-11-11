import type { Measurable } from '../core/util/kind'
import type { BoolInfo, ParamInfo, ParamOf, Refine } from './narrowing'

export interface SizeParams {
  /**
   * Value is empty (`true`) or not empty (`false`).
   *
   * Passes when the value is a string, array, Map, Set or plain object and its size (length, size,
   * or own enumerable key count) is 0 (`true`) / greater than 0 (`false`). Anything else, including
   * `null`, fails both polarities. Does not narrow.
   *
   * @example
   * affirm(cart.items, { isEmpty: false })
   * affirm(input, { anyOf: [{ isNullish: true }, { isEmpty: true }] }) // "null or empty"
   */
  isEmpty?: boolean
  /**
   * Value is not empty (`true`) or empty (`false`). The opposite of `isEmpty`, same kinds.
   *
   * Passes when the size is greater than 0 (`true`) / is 0 (`false`). Non-measurable values fail
   * both polarities. Does not narrow.
   *
   * @example
   * affirm(order.items, { isNotEmpty: true })
   */
  isNotEmpty?: boolean
  /**
   * Value is a blank string (`true`) or a string with non-whitespace (`false`).
   *
   * Passes when the value is a string and `(value.trim() === '') === param`. Non-strings fail both
   * polarities. Narrows to `string` (refined).
   *
   * @example
   * affirm(form.name, { isBlank: false })
   */
  isBlank?: boolean
  /**
   * Value's length (string, array) or size (Map, Set) is exactly n.
   *
   * Passes when the size `=== n`. Plain objects and other values fail. n must be a non-negative
   * integer. Narrows to `string | readonly unknown[] | ReadonlyMap | ReadonlySet` (refined).
   *
   * @example
   * affirm(otp, { isType: 'string', hasLength: 6 })
   */
  hasLength?: number
  /**
   * Value's length or size is at least n.
   *
   * Passes when the size `>= n` (strings, arrays, Maps, Sets). n must be a non-negative integer.
   * Narrows like `hasLength`.
   *
   * @example
   * affirm(password, { hasMinLength: 12 })
   */
  hasMinLength?: number
  /**
   * Value's length or size is at most n.
   *
   * Passes when the size `<= n` (strings, arrays, Maps, Sets). n must be a non-negative integer.
   * Narrows like `hasLength`.
   *
   * @example
   * affirm(bio, { hasMaxLength: 280 })
   */
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

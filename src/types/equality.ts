import type { Exact, IsLiteral, ParamInfo, ParamOf, Refine } from './narrowing.js'

export interface EqualityParams {
  /**
   * Value is exactly this value.
   *
   * Passes when `value === param`. Objects compare by reference; use `isDeepEqual` for structure.
   * Narrows to the param's type. Exact for literal params, so the `else` branch excludes it.
   *
   * @example
   * if (affirm(role, { is: 'admin' })) { role } // role: 'admin'
   */
  is?: unknown
  /**
   * Value is not this value.
   *
   * Passes when `value !== param`. Does not narrow.
   *
   * @example
   * affirm(status, { isNot: 'deleted' })
   */
  isNot?: unknown
  /**
   * Value is one of the listed values.
   *
   * Passes when the list includes the value (SameValueZero: like `===`, but `NaN` matches `NaN`).
   * `[]` never passes. Narrows to the union of the elements; exact when they are all literals.
   *
   * @example
   * if (affirm(size, { isOneOf: ['s', 'm', 'l'] })) { size } // size: 's' | 'm' | 'l'
   */
  isOneOf?: readonly unknown[]
  /**
   * Value is none of the listed values.
   *
   * Passes when the list does not include the value (SameValueZero). `[]` always passes. Does not narrow.
   *
   * @example
   * affirm(username, { isNotOneOf: ['admin', 'root'] })
   */
  isNotOneOf?: readonly unknown[]
  /**
   * Value is structurally equal to this value.
   *
   * Passes when both have the same type and contents: arrays elementwise, plain objects by own
   * enumerable keys, Dates by time, RegExps by source and flags, Maps by keys and deep values,
   * Sets by members (not deep). Other class instances compare by reference. Does not narrow.
   *
   * @example
   * affirm(config.retry, { isDeepEqual: { attempts: 3, backoff: 'exponential' } })
   */
  isDeepEqual?: unknown
}

/** `is` narrows to the param's type; exact only for literal params (design §5). */
type IsInfo<V> = ParamInfo<V, IsLiteral<V> extends true ? Exact<V> : Refine<V>>

type IsOneOfInfo<V> = ParamInfo<
  V,
  V extends readonly unknown[] ? (IsLiteral<V[number]> extends true ? Exact<V[number]> : Refine<V[number]>) : Refine
>

/** No narrowing: `ParamInfo<V, Refine>` skips when absent, otherwise refined with `n: unknown`. */
type NoNarrow<V> = ParamInfo<V, Refine>

export type EqualityInfos<P> = [
  IsInfo<ParamOf<P, 'is'>>,
  NoNarrow<ParamOf<P, 'isNot'>>,
  IsOneOfInfo<ParamOf<P, 'isOneOf'>>,
  NoNarrow<ParamOf<P, 'isNotOneOf'>>,
  NoNarrow<ParamOf<P, 'isDeepEqual'>>,
]

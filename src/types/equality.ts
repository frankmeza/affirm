// Full JSDoc + @example in M6.
import type { Exact, IsLiteral, ParamInfo, ParamOf, Refine } from './narrowing'

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

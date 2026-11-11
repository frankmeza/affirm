// Full JSDoc + @example in M6.
import type { IsExactNested, NarrowNested } from './affirmed'
import type { Exact, ParamInfo, ParamOf, Refine } from './narrowing'
import type { AffirmParams } from './params'
import type { TypeGuard } from './runtime-type'

export interface CompositionParams {
  /** Passes when the nested params fail. Does not narrow. */
  not?: AffirmParams
  /** Passes when at least one branch passes (the only way to express OR). Must be non-empty. */
  anyOf?: readonly AffirmParams[]
  /**
   * Escape hatch: a predicate or type guard, run last. Use it for prototype getters,
   * cross-field rules and anything else the keys can't express.
   */
  satisfies?: ((value: unknown) => boolean) | TypeGuard
}

/** Union of each branch's narrowing; exact only when every branch is exact (design §6.3). */
type AnyOfInfo<V> = ParamInfo<
  V,
  V extends readonly unknown[]
    ? false extends { [I in keyof V]: IsExactNested<V[I]> }[number]
      ? Refine<{ [I in keyof V]: NarrowNested<V[I]> }[number]>
      : Exact<{ [I in keyof V]: NarrowNested<V[I]> }[number]>
    : Refine
>

type SatisfiesInfo<V> = ParamInfo<V, V extends TypeGuard<infer T> ? Refine<T> : Refine>

export type CompositionInfos<P> = [
  ParamInfo<ParamOf<P, 'not'>, Refine>,
  AnyOfInfo<ParamOf<P, 'anyOf'>>,
  SatisfiesInfo<ParamOf<P, 'satisfies'>>,
]

import type { IsExactNested, NarrowNested } from './affirmed.js'
import type { Exact, ParamInfo, ParamOf, Refine } from './narrowing.js'
import type { AffirmParams } from './params.js'
import type { TypeGuard } from './runtime-type.js'

export interface CompositionParams {
  /**
   * Value fails these params.
   *
   * Passes when the nested params fail. The nested keys combine with AND, so
   * `not: { a, b }` means "not (a and b)". Does not narrow.
   *
   * @example
   * affirm(username, { not: { isOneOf: ['admin', 'root'] } })
   */
  not?: AffirmParams
  /**
   * Value passes at least one of these param branches: the only way to express OR.
   *
   * Passes when any branch passes. Must be non-empty. On failure, the report lists each branch's
   * failures in `branches`. Narrows to the union of the branches' narrowing; exact when every
   * branch is exact.
   *
   * @example
   * if (affirm(note, { anyOf: [{ isNull: true }, { isType: 'string' }] })) { note } // string | null
   */
  anyOf?: readonly AffirmParams[]
  /**
   * Value satisfies this predicate. The escape hatch, always run last.
   *
   * Passes when the predicate returns exactly `true`. Use it for prototype getters, cross-field
   * rules and anything the other keys can't express. Errors thrown by the predicate propagate.
   * A type guard narrows to its type (refined); a plain predicate does not narrow.
   *
   * @example
   * affirm(range, { satisfies: (r) => isRange(r) && r.min <= r.max }) // the param is `unknown`: guard first
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

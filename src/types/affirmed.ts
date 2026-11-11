import type { ArrayInfos } from './arrays'
import type { EqualityInfos } from './equality'
import type { ExactOf, NarrowOf, Refined } from './narrowing'
import type { NullishInfos } from './nullish'
import type { NumberInfos } from './numbers'
import type { ObjectInfos } from './objects'
import type { RuntimeTypeInfos } from './runtime-type'
import type { SizeInfos } from './size'
import type { StringInfos } from './strings'

/** Every group's key infos, concatenated. Groups are added as they land (M3, M4). */
type AllInfos<P> = [
  ...EqualityInfos<P>,
  ...NullishInfos<P>,
  ...RuntimeTypeInfos<P>,
  ...SizeInfos<P>,
  ...NumberInfos<P>,
  ...StringInfos<P>,
  ...ObjectInfos<P>,
  ...ArrayInfos<P>,
]

/** What P narrows to on its own (before combining with the input type). */
export type Narrow<P> = NarrowOf<AllInfos<P>>

/** `true` when every present key is exact, so the `else` branch may exclude `Narrow<P>`. */
export type IsExact<P> = ExactOf<AllInfos<P>>

/**
 * Narrows V by C the way TypeScript narrows a union with a type guard:
 * keep constituents of V that are subtypes of C, replace constituents that C refines,
 * drop unrelated constituents; if nothing is related, fall back to `V & C`.
 */
type Filter<V, C> = V extends unknown ? (C extends unknown ? (V extends C ? V : C extends V ? C : never) : never) : never
type NarrowTo<V, C> = [Filter<V, C>] extends [never] ? V & C : Filter<V, C>

/**
 * The type of `value` after `affirm(value, params)` returns `true` (design §6.3).
 * Exact params: plain narrowed type, and the `else` branch excludes it.
 * Otherwise: narrowed type `& Refined`, and the `else` branch keeps everything.
 */
export type Affirmed<V, P> = IsExact<P> extends true ? NarrowTo<V, Narrow<P>> : NarrowTo<V, Narrow<P>> & Refined

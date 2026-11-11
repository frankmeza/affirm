import type { ArrayInfos } from './arrays'
import type { CompositionInfos } from './composition'
import type { EqualityInfos } from './equality'
import type { ExactOf, NarrowOf, NarrowTo, Refined } from './narrowing'
import type { NullishInfos } from './nullish'
import type { AffirmParams } from './params'
import type { NumberInfos } from './numbers'
import type { ObjectInfos } from './objects'
import type { RuntimeTypeInfos } from './runtime-type'
import type { SizeInfos } from './size'
import type { StringInfos } from './strings'

/** Every group's key infos, concatenated. */
type AllInfos<P> = [
  ...EqualityInfos<P>,
  ...NullishInfos<P>,
  ...RuntimeTypeInfos<P>,
  ...SizeInfos<P>,
  ...NumberInfos<P>,
  ...StringInfos<P>,
  ...ObjectInfos<P>,
  ...ArrayInfos<P>,
  ...CompositionInfos<P>,
]

/** What P narrows to on its own (before combining with the input type). */
export type Narrow<P> = NarrowOf<AllInfos<P>>

/** `true` when every present key is exact, so the `else` branch may exclude `Narrow<P>`. */
export type IsExact<P> = ExactOf<AllInfos<P>>

type Result<V, P> = NarrowTo<V, Narrow<P>>

/**
 * `false` when narrowing would be unsound: refined params whose result can be `null` or `undefined`.
 * `null & Refined` reduces to `never`, so the brand would silently drop `null` from the `if` branch
 * (`isFalsy: true` on `string | null` would claim `string`); leaving `null` unbranded would wrongly
 * drop it from the `else` branch. TypeScript predicates can't express either side soundly, so these
 * calls fall back to a plain `boolean` (design §6.3 fallback).
 */
export type CanNarrow<V, P> = IsExact<P> extends true
  ? true
  : null extends Result<V, P>
    ? false
    : undefined extends Result<V, P>
      ? false
      : true

/**
 * The type of `value` after `affirm(value, params)` returns `true` (design §6.3).
 * Exact params: plain narrowed type, and the `else` branch excludes it.
 * Otherwise: narrowed type `& Refined`, and the `else` branch keeps everything.
 * (When `CanNarrow` is false, `affirm` returns a plain boolean; this type then omits the brand.)
 */
export type Affirmed<V, P> = IsExact<P> extends true
  ? Result<V, P>
  : CanNarrow<V, P> extends true
    ? Result<V, P> & Refined
    : Result<V, P>

/**
 * `Narrow` / `IsExact` for nested params (shape fields, everyItem, anyOf branches).
 * Stops recursion when the nested params are the wide `AffirmParams` type (e.g. a params variable,
 * or the constraint TypeScript checks the signature against), which would otherwise recurse forever.
 */
export type NarrowNested<P> = AffirmParams extends P ? unknown : Narrow<P>
export type IsExactNested<P> = AffirmParams extends P ? false : IsExact<P>

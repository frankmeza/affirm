// Full JSDoc + @example in M6. `everyItem` / `someItem` land in M4.
// Value must be an array. Membership uses SameValueZero (NaN matches NaN).
import type { ParamInfo, ParamOf, Refine } from './narrowing'

export interface ArrayParams {
  /** The array includes this item (SameValueZero). For substrings use `includes`. */
  contains?: unknown
  /** The array includes every one of these items. `[]` always passes. */
  containsAll?: readonly unknown[]
  /** The array includes at least one of these items. `[]` never passes. */
  containsAny?: readonly unknown[]
}

type ArrayInfo<V> = ParamInfo<V, Refine<readonly unknown[]>>

export type ArrayInfos<P> = [
  ArrayInfo<ParamOf<P, 'contains'>>,
  ArrayInfo<ParamOf<P, 'containsAll'>>,
  ArrayInfo<ParamOf<P, 'containsAny'>>,
]

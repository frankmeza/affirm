// Full JSDoc + @example in M6.
// Value must be an array. Membership uses SameValueZero (NaN matches NaN).
import type { NarrowNested } from './affirmed'
import type { ParamInfo, ParamOf, Refine } from './narrowing'
import type { AffirmParams } from './params'

export interface ArrayParams {
  /** The array includes this item (SameValueZero). For substrings use `includes`. */
  contains?: unknown
  /** The array includes every one of these items. `[]` always passes. */
  containsAll?: readonly unknown[]
  /** The array includes at least one of these items. `[]` never passes. */
  containsAny?: readonly unknown[]
  /** Every item passes these params. `[]` passes (vacuously true). */
  everyItem?: AffirmParams
  /** At least one item passes these params. `[]` fails. */
  someItem?: AffirmParams
}

type ArrayInfo<V> = ParamInfo<V, Refine<readonly unknown[]>>

export type ArrayInfos<P> = [
  ArrayInfo<ParamOf<P, 'contains'>>,
  ArrayInfo<ParamOf<P, 'containsAll'>>,
  ArrayInfo<ParamOf<P, 'containsAny'>>,
  ParamInfo<ParamOf<P, 'everyItem'>, Refine<readonly NarrowNested<ParamOf<P, 'everyItem'>>[]>>,
  ArrayInfo<ParamOf<P, 'someItem'>>,
]

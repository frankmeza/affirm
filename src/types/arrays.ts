// Value must be an array. Membership uses SameValueZero (NaN matches NaN).
import type { NarrowNested } from './affirmed.js'
import type { ParamInfo, ParamOf, Refine } from './narrowing.js'
import type { AffirmParams } from './params.js'

export interface ArrayParams {
  /**
   * Value is an array that includes this item. Arrays only: for substrings use `includes`.
   *
   * Passes when the value is an array and includes the item (SameValueZero: like `===`, but `NaN`
   * matches `NaN`). Objects match by reference. Narrows to the array type (refined).
   *
   * @example
   * affirm(user.roles, { contains: 'admin' })
   */
  contains?: unknown
  /**
   * Value is an array that includes every one of these items.
   *
   * Passes when the value is an array and includes each item (SameValueZero). `[]` always passes.
   * Narrows to the array type (refined).
   *
   * @example
   * affirm(grantedScopes, { containsAll: ['read', 'write'] })
   */
  containsAll?: readonly unknown[]
  /**
   * Value is an array that includes at least one of these items.
   *
   * Passes when the value is an array and includes any item (SameValueZero). `[]` never passes.
   * Narrows to the array type (refined).
   *
   * @example
   * affirm(user.roles, { containsAny: ['admin', 'owner'] })
   */
  containsAny?: readonly unknown[]
  /**
   * Value is an array whose every item passes these params.
   *
   * Passes when the value is an array and each item passes. `[]` passes (vacuously true). Failures
   * report the item path, e.g. `items[2].id`. Narrows the element type (refined).
   *
   * @example
   * affirm(order.items, { isNotEmpty: true, everyItem: { shape: { qty: { isInteger: true, isAtLeast: 1 } } } })
   */
  everyItem?: AffirmParams
  /**
   * Value is an array where at least one item passes these params.
   *
   * Passes when the value is an array and any item passes. `[]` fails. Reports one failure, not one
   * per item. Narrows to the array type (refined).
   *
   * @example
   * affirm(addresses, { someItem: { shape: { isDefault: { is: true } } } })
   */
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

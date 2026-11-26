// Value must be a non-null object or array. Own-key semantics (D2): `Object.hasOwn`.
import type { NarrowNested } from './affirmed.js'
import type { IsLiteral, IsUnion, ParamInfo, ParamOf, Refine } from './narrowing.js'
import type { AffirmParams } from './params.js'

export interface ObjectParams {
  /**
   * Each listed field of the value passes its own params.
   *
   * Passes when the value is a non-null object (or array) and every listed field passes. A missing
   * or inherited field is checked as `undefined`, so `{ isUndefined: true }` accepts it. Unlisted
   * fields are ignored (add `hasOnlyKeys` to forbid them). Failures report the field path, e.g.
   * `address.zip`. Narrows to `{ [field]: <narrowed field type> }` (refined).
   *
   * @example
   * affirm(order, { shape: { total: { isType: 'number', isPositive: true }, id: { startsWith: 'ord_' } } })
   */
  shape?: { readonly [field: string]: AffirmParams }
  /**
   * Value is an object that has this own key.
   *
   * Passes when the value is a non-null object (or array) and `Object.hasOwn(value, key)`. Inherited
   * keys and prototype getters don't count (use `satisfies`). A key set to `undefined` counts.
   * A literal key narrows to `Record<key, unknown>` (refined).
   *
   * @example
   * if (affirm(payload, { hasKey: 'total' })) { payload.total } // payload.total: unknown
   */
  hasKey?: PropertyKey
  /**
   * Value is an object that has every one of these own keys.
   *
   * Passes when the value is a non-null object (or array) and has each key (`Object.hasOwn`).
   * `[]` passes. Literal keys narrow to `Record<keys, unknown>` (refined).
   *
   * @example
   * affirm(row, { hasKeys: ['id', 'createdAt'] })
   */
  hasKeys?: readonly PropertyKey[]
  /**
   * Value is an object that has at least one of these own keys.
   *
   * Passes when the value is a non-null object (or array) and has any of the keys. `[]` never passes.
   * Narrows to `object` (refined).
   *
   * @example
   * affirm(contact, { hasAnyKey: ['email', 'phone'] })
   */
  hasAnyKey?: readonly PropertyKey[]
  /**
   * Value is an object with no own enumerable keys outside this list.
   *
   * Passes when the value is a non-null object (or array) and every own enumerable key (string or
   * symbol) is listed. Does not require the listed keys to be present. `1` and `'1'` are the same
   * key. Narrows to `object` (refined).
   *
   * @example
   * affirm(query, { hasOnlyKeys: ['page', 'limit', 'sort'] })
   */
  hasOnlyKeys?: readonly PropertyKey[]
  /**
   * Value has every segment of this dot path as an own key, at each level.
   *
   * Passes when each segment exists on an object or array along the way (`Object.hasOwn`). Numeric
   * segments index arrays. The last segment may hold `undefined`. Empty segments (`'a..b'`) throw.
   * A literal path narrows to the nested type, e.g. `{ items: { 0: { id: unknown } } }` (refined).
   *
   * @example
   * affirm(event, { hasPath: 'data.object.customer' })
   */
  hasPath?: string
}

/** `'a.b.0'` → `{ a: { b: { 0: unknown } } }` */
export type PathType<S extends string> = S extends `${infer Head}.${infer Rest}`
  ? { [K in Head]: PathType<Rest> }
  : { [K in S]: unknown }

/** A single literal key narrows to `Record<K, unknown>`; a wide or union key only to `object`. */
type HasKeyInfo<V> = ParamInfo<
  V,
  V extends PropertyKey
    ? IsLiteral<V> extends true
      ? IsUnion<V> extends true
        ? Refine<object>
        : Refine<Record<V, unknown>>
      : Refine<object>
    : Refine
>

/** All keys are required, so a union of literal keys is fine here. */
type HasKeysInfo<V> = ParamInfo<
  V,
  V extends readonly PropertyKey[]
    ? IsLiteral<V[number]> extends true
      ? Refine<Record<V[number], unknown>>
      : Refine<object>
    : Refine
>

type HasPathInfo<V> = ParamInfo<
  V,
  V extends string ? (IsLiteral<V> extends true ? (IsUnion<V> extends true ? Refine<object> : Refine<PathType<V>>) : Refine<object>) : Refine
>

/**
 * `{ total: { isType: 'number' } }` → `{ total: number }`. Field types use `Narrow` (no brand):
 * the outer call is always refined, so the brand on fields would only add noise.
 */
type ShapeInfo<V> = ParamInfo<V, V extends object ? Refine<{ -readonly [K in keyof V]: NarrowNested<V[K]> }> : Refine>

export type ObjectInfos<P> = [
  ShapeInfo<ParamOf<P, 'shape'>>,
  HasKeyInfo<ParamOf<P, 'hasKey'>>,
  HasKeysInfo<ParamOf<P, 'hasKeys'>>,
  ParamInfo<ParamOf<P, 'hasAnyKey'>, Refine<object>>,
  ParamInfo<ParamOf<P, 'hasOnlyKeys'>, Refine<object>>,
  HasPathInfo<ParamOf<P, 'hasPath'>>,
]

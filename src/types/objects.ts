// Full JSDoc + @example in M6. `shape` lands in M4.
// Value must be a non-null object or array. Own-key semantics (D2): `Object.hasOwn`.
import type { IsLiteral, IsUnion, ParamInfo, ParamOf, Refine } from './narrowing'

export interface ObjectParams {
  /** The value has this own key (`Object.hasOwn`). */
  hasKey?: PropertyKey
  /** The value has every one of these own keys. */
  hasKeys?: readonly PropertyKey[]
  /** The value has at least one of these own keys. `[]` never passes. */
  hasAnyKey?: readonly PropertyKey[]
  /** The value has no own enumerable key outside this list. Does not require any to be present. */
  hasOnlyKeys?: readonly PropertyKey[]
  /**
   * Every segment of a dot path exists as an own key: `'user.address.zip'`, `'items.0.id'`
   * (numeric segments index arrays).
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

export type ObjectInfos<P> = [
  HasKeyInfo<ParamOf<P, 'hasKey'>>,
  HasKeysInfo<ParamOf<P, 'hasKeys'>>,
  ParamInfo<ParamOf<P, 'hasAnyKey'>, Refine<object>>,
  ParamInfo<ParamOf<P, 'hasOnlyKeys'>, Refine<object>>,
  HasPathInfo<ParamOf<P, 'hasPath'>>,
]

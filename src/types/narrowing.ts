// Shared building blocks for type narrowing (design §6.3).
//
// Every params key contributes one `KeyInfo`: what it narrows to (`n`) and whether it is
// *exact* (`e`: a value of type `n` passes ⇔ the runtime check passes). Groups export a tuple
// of KeyInfos (`EqualityInfos<P>` etc.); `affirmed.ts` concatenates and folds them.

declare const refined: unique symbol

/**
 * Phantom brand added when any key is *refined* (not exact). No real type is assignable to it,
 * so TypeScript cannot exclude anything in the `else` branch, while the `if` branch still gets
 * the narrowed type (`string & Refined` is usable anywhere a `string` is).
 *
 * `{}` and `object` are *assignable* to this all-optional type, but narrowing uses the strict
 * subtype relation, under which they are not subtypes, so `else` branches keep them too.
 * Covered by the "{} and object constituents" type test.
 */
export interface Refined {
  readonly [refined]?: never
}

export interface KeyInfo {
  readonly n: unknown
  readonly e: boolean
}

/** Key absent or `undefined`: no narrowing, does not affect exactness. */
export type Skip = { n: unknown; e: true }
/** Narrows to `N`, and failing the check means the value is not an `N`. */
export type Exact<N> = { n: N; e: true }
/** Narrows to `N` in the `if` branch only. */
export type Refine<N = unknown> = { n: N; e: false }

/** The param for key `K`, or `undefined` when P doesn't have it. */
export type ParamOf<P, K extends PropertyKey> = K extends keyof P ? P[K] : undefined

/**
 * Boolean keys (D1). `T` is the info for `true`, `F` for `false`.
 * A non-literal `boolean` (or `boolean | undefined`) param can't be narrowed on.
 */
export type BoolInfo<V, T extends KeyInfo, F extends KeyInfo> = [V] extends [undefined]
  ? Skip
  : [V] extends [true]
    ? T
    : [V] extends [false]
      ? F
      : Refine

/** Guards the common case for non-boolean keys: absent → Skip, maybe-undefined → Refine. */
export type ParamInfo<V, Info extends KeyInfo> = [V] extends [undefined]
  ? Skip
  : undefined extends V
    ? Refine
    : Info

/** `true` when T is a union of unit types (string/number/bigint/boolean literals, null, unique symbols). */
export type IsLiteral<T> = [T] extends [never]
  ? false
  : (T extends unknown ? IsUnit<T> : never) extends true
    ? true
    : false

type IsUnit<T> = T extends null
  ? true
  : T extends string
    ? string extends T
      ? false
      : true
    : T extends number
      ? number extends T
        ? false
        : true
      : T extends bigint
        ? bigint extends T
          ? false
          : true
        : T extends boolean
          ? true
          : T extends symbol
            ? symbol extends T
              ? false
              : true
            : false

export type IsUnion<T, U = T> = (T extends unknown ? ([U] extends [T] ? false : true) : never) extends false
  ? false
  : true

/** Intersection of every info's `n`. */
export type NarrowOf<T extends readonly KeyInfo[]> = T extends readonly [
  infer H extends KeyInfo,
  ...infer R extends readonly KeyInfo[],
]
  ? H['n'] & NarrowOf<R>
  : unknown

/** `true` only when every info is exact. */
export type ExactOf<T extends readonly KeyInfo[]> = false extends T[number]['e'] ? false : true

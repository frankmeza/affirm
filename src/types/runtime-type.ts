// Full JSDoc + @example in M6. Standard Schema support for `isType` lands in M5.
import type { BoolInfo, Exact, IsUnion, ParamInfo, ParamOf, Refine } from './narrowing'

export type TypeTag = 'string' | 'number' | 'boolean' | 'bigint' | 'symbol' | 'function' | 'object'

/** A user type guard, e.g. `(v: unknown): v is User => …`. */
export type TypeGuard<T = unknown> = (value: unknown) => value is T

/** What `isFunction: true` and `isType: 'function'` narrow to. */
export type AnyFunction = (...args: never[]) => unknown

export interface RuntimeTypeParams {
  /**
   * A `typeof` tag (`'object'` excludes `null`, includes arrays) or a type guard.
   * Not `'null'`/`'undefined'` (use `isNull`/`isUndefined`); not a class (use `isInstanceOf`).
   */
  isType?: TypeTag | TypeGuard
  /** `true`: `Array.isArray(value)`. */
  isArray?: boolean
  /** `true`: prototype is `Object.prototype` or `null`. */
  isPlainObject?: boolean
  /** `true`: `typeof value === 'function'`. */
  isFunction?: boolean
  /** Passes when `value instanceof param`. */
  isInstanceOf?: abstract new (...args: any) => any
  /** `true`: a `Date` with a valid time. `false`: an invalid `Date`. Non-Dates fail both (D7). */
  isValidDate?: boolean
  /** `true`: `Number.isInteger(value)`. Non-numbers fail both polarities (D7). */
  isInteger?: boolean
  /** `true`: `Number.isFinite(value)`. Non-numbers fail both polarities (D7). */
  isFiniteNumber?: boolean
  /** `true`: `Number.isNaN(value)`. Non-numbers fail both polarities (D7). */
  isNaN?: boolean
}

interface TagTypes {
  string: string
  number: number
  boolean: boolean
  bigint: bigint
  symbol: symbol
  function: AnyFunction
  object: object
}

type IsTypeInfo<V> = ParamInfo<
  V,
  V extends TypeGuard<infer T>
    ? Exact<T> // same contract as a TS guard
    : [V] extends [TypeTag]
      ? IsUnion<V> extends true
        ? Refine<TagTypes[V]> // a non-literal tag: we don't know which one
        : V extends 'object'
          ? Refine<object> // TS `object` includes functions
          : Exact<TagTypes[V]>
      : Refine
>

type InstanceInfo<V> = ParamInfo<V, V extends abstract new (...args: any) => infer I ? Refine<I> : Refine>

// D7: kind-gated keys narrow to their kind in BOTH polarities.
type Gated<V, Kind> = BoolInfo<V, Refine<Kind>, Refine<Kind>>

export type RuntimeTypeInfos<P> = [
  IsTypeInfo<ParamOf<P, 'isType'>>,
  BoolInfo<ParamOf<P, 'isArray'>, Exact<readonly unknown[]>, Refine>,
  BoolInfo<ParamOf<P, 'isPlainObject'>, Refine<Record<string, unknown>>, Refine>,
  BoolInfo<ParamOf<P, 'isFunction'>, Exact<AnyFunction>, Refine>,
  InstanceInfo<ParamOf<P, 'isInstanceOf'>>,
  Gated<ParamOf<P, 'isValidDate'>, Date>,
  Gated<ParamOf<P, 'isInteger'>, number>,
  Gated<ParamOf<P, 'isFiniteNumber'>, number>,
  Gated<ParamOf<P, 'isNaN'>, number>,
]

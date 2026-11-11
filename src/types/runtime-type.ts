import type { StandardSchemaV1 } from '../core/util/standard-schema'
import type { BoolInfo, Exact, IsUnion, ParamInfo, ParamOf, Refine } from './narrowing'

export type TypeTag = 'string' | 'number' | 'boolean' | 'bigint' | 'symbol' | 'function' | 'object'

/** A user type guard, e.g. `(v: unknown): v is User => …`. */
export type TypeGuard<T = unknown> = (value: unknown) => value is T

/** What `isFunction: true` and `isType: 'function'` narrow to. */
export type AnyFunction = (...args: never[]) => unknown

export interface RuntimeTypeParams {
  /**
   * Value has this runtime type: a `typeof` tag, a type guard, or a synchronous Standard Schema.
   *
   * Passes when the value matches the param:
   * - Tag: passes when `typeof value === tag`, except `'object'` also requires non-null (arrays
   *   pass). `'function'` also matches classes (calling one without `new` throws). Exact, except `'object'`.
   * - Guard `(v: unknown): v is T`: passes when it returns exactly `true`. Narrows to `T`, exact.
   * - Standard Schema (Zod, Valibot, ArkType, …): passes when `validate` reports no issues. Narrows
   *   to the schema's *input* type, refined. Nothing is parsed or transformed. Async schemas throw.
   *
   * Not `'null'` / `'undefined'` (use `isNull` / `isUndefined`); not a class (use `isInstanceOf`).
   *
   * @example
   * if (affirm(id, { isType: 'string' })) { id.trim() }
   * if (affirm(body, { isType: OrderSchema })) { body.items } // a Zod schema
   */
  isType?: TypeTag | TypeGuard | StandardSchemaV1
  /**
   * Value is an array (`true`) or is not (`false`).
   *
   * Passes when `Array.isArray(value) === param`. `true` narrows to `readonly unknown[]` (or the
   * array members of the input type), exact. `false` does not narrow.
   *
   * @example
   * if (affirm(tags, { isArray: true })) { tags.length }
   */
  isArray?: boolean
  /**
   * Value is a plain object (`true`) or is not (`false`).
   *
   * Passes when the prototype is `Object.prototype` or `null` (so `Object.create(null)` passes).
   * Arrays, Dates, Maps and class instances fail. `true` narrows to `Record<string, unknown>` (refined).
   *
   * @example
   * affirm(JSON.parse(text), { isPlainObject: true })
   */
  isPlainObject?: boolean
  /**
   * Value is a function (`true`) or is not (`false`).
   *
   * Passes when `(typeof value === 'function') === param`. Classes are functions and pass; calling
   * one without `new` throws. `true` narrows to `(...args: never[]) => unknown`, exact.
   *
   * @example
   * if (affirm(options.onError, { isFunction: true })) { … }
   */
  isFunction?: boolean
  /**
   * Value is an instance of this class.
   *
   * Passes when `value instanceof param`. Narrows to the instance type (refined).
   *
   * @example
   * if (affirm(error, { isInstanceOf: HttpError })) { error.status }
   */
  isInstanceOf?: abstract new (...args: any) => any
  /**
   * Value is a `Date` with a valid time (`true`), or an invalid `Date` (`false`).
   *
   * Passes when the value is a `Date` and `!isNaN(value.getTime()) === param`. Non-Dates (including
   * date strings) fail both polarities. Narrows to `Date` (refined).
   *
   * @example
   * affirm(new Date(input), { isValidDate: true })
   */
  isValidDate?: boolean
  /**
   * Value is an integer (`true`) or a non-integer number (`false`).
   *
   * Passes when the value is a number and `Number.isInteger(value) === param`. Non-numbers fail
   * both polarities (no coercion: `'3'` fails). Narrows to `number` (refined).
   *
   * @example
   * affirm(quantity, { isInteger: true, isAtLeast: 1 })
   */
  isInteger?: boolean
  /**
   * Value is a finite number (`true`), or `Infinity` / `-Infinity` / `NaN` (`false`).
   *
   * Passes when the value is a number and `Number.isFinite(value) === param`. Non-numbers fail
   * both polarities. Narrows to `number` (refined).
   *
   * @example
   * affirm(price, { isFiniteNumber: true })
   */
  isFiniteNumber?: boolean
  /**
   * Value is `NaN` (`true`) or a number other than `NaN` (`false`).
   *
   * Passes when the value is a number and `Number.isNaN(value) === param`. Non-numbers fail both
   * polarities (unlike global `isNaN`, `'abc'` is not NaN here). Narrows to `number` (refined).
   *
   * @example
   * affirm(Number(input), { isNaN: false })
   */
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
  V extends StandardSchemaV1
    ? Refine<StandardSchemaV1.InferInput<V>> // input, not output: affirm never transforms the value
    : V extends TypeGuard<infer T>
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

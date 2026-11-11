import type { AffirmParams } from '../types/params'
import { formatParam } from './describe'
import { makeFailure, type AffirmFailure } from './report'

/** Canonical evaluation phases (design §4 rule 7). Lower runs first. */
export const Phase = {
  /** Cheap type / nullish / equality checks. */
  Kind: 0,
  /** Size, number and string checks. */
  Measure: 1,
  /** Structural checks: shape, everyItem, isDeepEqual, … */
  Structural: 2,
  /** User predicates: satisfies. */
  Predicate: 3,
} as const
export type Phase = (typeof Phase)[keyof typeof Phase]

export type Mode = 'first' | 'all'

export interface EvalContext {
  /** The params key being evaluated. */
  readonly key: string
  /** Path of the value being checked; `''` at the root. */
  readonly path: string
  /** `'first'` for `affirm()` (short-circuit), `'all'` for `explain()` (collect everything). */
  readonly mode: Mode
  /** Recursion for composite keys: failures of nested params, in the current mode. Params must already be validated. */
  run(value: unknown, params: AffirmParams, path: string): AffirmFailure[]
  /** Pass/fail of nested params, always short-circuiting. For `not` and `someItem`. */
  test(value: unknown, params: AffirmParams): boolean
}

/** Validates nested params (throws `TypeError`). Passed to composite keys so checks don't import the engine. */
export type ValidateNested = (params: unknown, path: string) => void

export interface CheckDef<Param> {
  readonly phase: Phase
  /**
   * Programmer-error guard (design §4 rule 6). Returns `undefined` when the param is valid,
   * otherwise a description of what was expected, e.g. `'a non-negative integer'`.
   * Composite keys validate their nested params with `validateNested`.
   */
  validateParam(param: unknown, path: string, validateNested: ValidateNested): string | undefined
  /** Returns `[]` on pass. */
  evaluate(value: unknown, param: Param, ctx: EvalContext): AffirmFailure[]
}

/** A group's runtime object: exactly one `CheckDef` per key of its params interface. */
export type CheckGroup<P> = { readonly [K in keyof P]-?: CheckDef<Exclude<P[K], undefined>> }

/** Optional kind gate: if `accepts` fails, one failure is reported and `test` never runs (rule 5, D7). */
interface Gate<V> {
  accepts?: (value: unknown) => value is V
  /** Shown as `expected` when the gate fails, e.g. `'a number'`. */
  acceptsLabel?: string
}

export interface LeafSpec<P, V> extends Gate<V> {
  phase: Phase
  validateParam: (param: unknown) => string | undefined
  test: (value: V, param: P) => boolean
  expected: (param: P) => string
}

/** Builds a check from a plain `(value, param) => boolean` test. */
export function leaf<P, V = unknown>(spec: LeafSpec<P, V>): CheckDef<P> {
  return {
    phase: spec.phase,
    validateParam: spec.validateParam,
    evaluate(value, param, ctx) {
      if (spec.accepts !== undefined && !spec.accepts(value)) {
        return [makeFailure(ctx.key, ctx.path, spec.acceptsLabel ?? 'a different kind of value', value)]
      }
      return spec.test(value as V, param) ? [] : [makeFailure(ctx.key, ctx.path, spec.expected(param), value)]
    },
  }
}

export interface BooleanLeafSpec<V> extends Gate<V> {
  phase: Phase
  test: (value: V) => boolean
  /** `expected` when the param is `true`, e.g. `'null'`. */
  expected: string
  /** `expected` when the param is `false`, e.g. `'not null'`. */
  expectedNot: string
}

/**
 * Builds a boolean key. Implements D1 once: pass ⇔ `test(value) === param`.
 * The kind gate (if any) runs first and fails for both polarities (D7).
 */
export function booleanLeaf<V = unknown>(spec: BooleanLeafSpec<V>): CheckDef<boolean> {
  return {
    phase: spec.phase,
    validateParam: (param) => (typeof param === 'boolean' ? undefined : 'a boolean'),
    evaluate(value, param, ctx) {
      if (spec.accepts !== undefined && !spec.accepts(value)) {
        return [makeFailure(ctx.key, ctx.path, spec.acceptsLabel ?? 'a different kind of value', value)]
      }
      if (spec.test(value as V) === param) return []
      return [makeFailure(ctx.key, ctx.path, param ? spec.expected : spec.expectedNot, value)]
    },
  }
}

export interface CompositeSpec<P, V> extends Gate<V> {
  phase: Phase
  validateParam: (param: unknown, path: string, validateNested: ValidateNested) => string | undefined
  /** Called only when the gate passes. Returns `[]` on pass. */
  evaluate: (value: V, param: P, ctx: EvalContext) => AffirmFailure[]
}

/**
 * Builds a composite key (shape, everyItem, anyOf, …). The kind gate runs first, so a value of the
 * wrong kind produces ONE failure instead of one per child (design §4 rule 7).
 */
export function composite<P, V = unknown>(spec: CompositeSpec<P, V>): CheckDef<P> {
  return {
    phase: spec.phase,
    validateParam: spec.validateParam,
    evaluate(value, param, ctx) {
      if (spec.accepts !== undefined && !spec.accepts(value)) {
        return [makeFailure(ctx.key, ctx.path, spec.acceptsLabel ?? 'a different kind of value', value)]
      }
      return spec.evaluate(value as V, param, ctx)
    },
  }
}

/** `{ isNull: true, hasKey: "id" }`: a short rendering of nested params for `expected`. */
export function formatParams(params: AffirmParams): string {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}: ${formatParam(v)}`)
  return `{ ${parts.join(', ')} }`
}

// Shared param validators -------------------------------------------------------------------

export const anyParam = (): undefined => undefined

export const arrayParam = (param: unknown): string | undefined =>
  Array.isArray(param) ? undefined : `an array (received ${formatParam(param)})`

export const functionParam = (param: unknown): string | undefined =>
  typeof param === 'function' ? undefined : `a function (received ${formatParam(param)})`

export const numberParam = (param: unknown): string | undefined =>
  typeof param === 'number' && !Number.isNaN(param) ? undefined : `a number, not NaN (received ${formatParam(param)})`

export const nonNegativeIntegerParam = (param: unknown): string | undefined =>
  Number.isInteger(param) && (param as number) >= 0
    ? undefined
    : `a non-negative integer (received ${formatParam(param)})`

export const stringParam = (param: unknown): string | undefined =>
  typeof param === 'string' ? undefined : `a string (received ${formatParam(param)})`

const isPropertyKey = (k: unknown): k is PropertyKey =>
  typeof k === 'string' || typeof k === 'number' || typeof k === 'symbol'

export const propertyKeyParam = (param: unknown): string | undefined =>
  isPropertyKey(param) ? undefined : `a string, number or symbol key (received ${formatParam(param)})`

export const propertyKeyListParam = (param: unknown): string | undefined =>
  Array.isArray(param) && param.every(isPropertyKey)
    ? undefined
    : `an array of string, number or symbol keys (received ${formatParam(param)})`

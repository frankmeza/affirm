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
  /** Recursion for composite keys. Params passed here must already be validated. */
  run(value: unknown, params: AffirmParams, path: string): AffirmFailure[]
}

export interface CheckDef<Param> {
  readonly phase: Phase
  /**
   * Programmer-error guard (design §4 rule 6). Returns `undefined` when the param is valid,
   * otherwise a description of what was expected, e.g. `'a non-negative integer'`.
   * Composite keys validate their nested params here as well.
   */
  validateParam(param: unknown, path: string): string | undefined
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

// Shared param validators -------------------------------------------------------------------

export const anyParam = (): undefined => undefined

export const arrayParam = (param: unknown): string | undefined =>
  Array.isArray(param) ? undefined : `an array (received ${formatParam(param)})`

export const functionParam = (param: unknown): string | undefined =>
  typeof param === 'function' ? undefined : `a function (received ${formatParam(param)})`

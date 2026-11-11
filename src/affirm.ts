import { AffirmError } from './core/errors'
import { runParams } from './core/evaluate'
import type { AffirmReport } from './core/report'
import { validateParams } from './core/validate-params'
import type { Affirmed, CanNarrow } from './types/affirmed'
import type { ParamsCheck } from './types/contradictions'
import type { AffirmParams } from './types/params'

/** Makes the narrowing overload inapplicable (so the boolean one is picked) when narrowing is unsound. */
type IfNarrowable<V, P> = CanNarrow<V, P> extends true ? unknown : never

/**
 * Design §6.1. `const P` keeps literal params (`is: 'admin'` narrows to `'admin'`).
 * Declared as an explicit interface so `affirm.assert` can carry an `asserts` signature.
 * Each narrowing signature has a non-narrowing twin for params where narrowing would be unsound
 * (see `CanNarrow`).
 */
export interface Affirm {
  /** Returns `true` when every check passes, and narrows `value` accordingly. */
  <V, const P extends AffirmParams>(value: V, params: P & ParamsCheck<P> & IfNarrowable<V, P>): value is Affirmed<V, P>
  /** Returns `true` when every check passes. */
  <V, const P extends AffirmParams>(value: V, params: P & ParamsCheck<P>): boolean
  /** Evaluates every check and reports all failures. Never throws on data failures. */
  explain<const P extends AffirmParams>(value: unknown, params: P & ParamsCheck<P>): AffirmReport
  /** Throws `AffirmError` unless every check passes; afterwards `value` is narrowed. */
  assert<V, const P extends AffirmParams>(
    value: V,
    params: P & ParamsCheck<P> & IfNarrowable<V, P>,
    message?: string,
  ): asserts value is Affirmed<V, P>
  /** Throws `AffirmError` unless every check passes. */
  assert<V, const P extends AffirmParams>(value: V, params: P & ParamsCheck<P>, message?: string): void
}

function call(value: unknown, params: AffirmParams): boolean {
  validateParams(params)
  return runParams(value, params, '', 'first').length === 0
}

function explain(value: unknown, params: AffirmParams): AffirmReport {
  validateParams(params)
  const failures = runParams(value, params, '', 'all')
  return { ok: failures.length === 0, failures }
}

function assertOrThrow(value: unknown, params: AffirmParams, message?: string): void {
  const report = explain(value, params)
  if (!report.ok) throw new AffirmError(report, message)
}

// The implementations are plain boolean/void functions; the narrowing lives only in `Affirm`.
export const affirm: Affirm = Object.assign(call, { explain, assert: assertOrThrow }) as Affirm

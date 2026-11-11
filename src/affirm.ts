import { AffirmError } from './core/errors'
import { runParams } from './core/evaluate'
import type { AffirmReport } from './core/report'
import { validateParams } from './core/validate-params'
import type { Affirmed } from './types/affirmed'
import type { ParamsCheck } from './types/contradictions'
import type { AffirmParams } from './types/params'

/**
 * Design §6.1. `const P` keeps literal params (`is: 'admin'` narrows to `'admin'`).
 * Declared as an explicit interface so `affirm.assert` can carry an `asserts` signature.
 */
export interface Affirm {
  /** Returns `true` when every check passes, and narrows `value` accordingly. */
  <V, const P extends AffirmParams>(value: V, params: P & ParamsCheck<P>): value is Affirmed<V, P>
  /** Evaluates every check and reports all failures. Never throws on data failures. */
  explain<const P extends AffirmParams>(value: unknown, params: P & ParamsCheck<P>): AffirmReport
  /** Throws `AffirmError` unless every check passes; afterwards `value` is narrowed. */
  assert<V, const P extends AffirmParams>(
    value: V,
    params: P & ParamsCheck<P>,
    message?: string,
  ): asserts value is Affirmed<V, P>
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

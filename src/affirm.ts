import { AffirmError } from './core/errors'
import { runParams } from './core/evaluate'
import type { AffirmReport } from './core/report'
import { validateParams } from './core/validate-params'
import type { AffirmParams } from './types/params'

/**
 * Provisional runtime-only signature. M2 replaces this with the narrowing `Affirm` interface
 * from design §6.1 (type predicate, `asserts` signature, `NoContradictions`).
 */
export interface Affirm {
  (value: unknown, params: AffirmParams): boolean
  explain(value: unknown, params: AffirmParams): AffirmReport
  assert(value: unknown, params: AffirmParams, message?: string): void
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

export const affirm: Affirm = Object.assign(call, { explain, assert: assertOrThrow })

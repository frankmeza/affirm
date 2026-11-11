import type { AffirmParams } from '../types/params'
import type { CheckDef, EvalContext, Mode } from './check-def'
import { checks, isCheckKey, rankOf, type CheckKey } from './registry'
import type { AffirmFailure } from './report'

/**
 * Runs already-validated params against a value in canonical key order (design §4 rule 7).
 * `'first'` stops at the first failing key; `'all'` collects every failure.
 */
export function runParams(value: unknown, params: AffirmParams, path: string, mode: Mode): AffirmFailure[] {
  const keys = (Object.keys(params).filter(isCheckKey) as CheckKey[]).sort((a, b) => rankOf(a) - rankOf(b))
  const failures: AffirmFailure[] = []
  const run = (v: unknown, p: AffirmParams, at: string) => runParams(v, p, at, mode)
  const test = (v: unknown, p: AffirmParams) => runParams(v, p, path, 'first').length === 0

  for (const key of keys) {
    const param = params[key]
    if (param === undefined) continue // rule 3
    const ctx: EvalContext = { key, path, mode, run, test }
    const result = (checks[key] as CheckDef<unknown>).evaluate(value, param, ctx)
    if (result.length > 0) {
      failures.push(...result)
      if (mode === 'first') break
    }
  }
  return failures
}

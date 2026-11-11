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
  /**
   * Checks `value` against named checks and returns `true` when all of them pass (keys combine
   * with AND; use `anyOf` for OR). Narrows `value` in the `if` branch.
   *
   * Data failures return `false`; programmer errors (unknown key, empty params, wrong param type,
   * async schema) throw `TypeError`. Use `affirm.explain` to see why a value failed.
   *
   * @example
   * if (affirm(order, { isPresent: true, shape: { total: { isType: 'number', isPositive: true } } })) {
   *   order.total // number
   * }
   */
  <V, const P extends AffirmParams>(value: V, params: P & ParamsCheck<P> & IfNarrowable<V, P>): value is Affirmed<V, P>
  /**
   * Checks `value` against named checks and returns `true` when all of them pass.
   * (This signature is used when narrowing would be unsound, e.g. `isFalsy` on `string | null`.)
   *
   * @example
   * if (affirm(name, { isFalsy: true })) return 'anonymous'
   */
  <V, const P extends AffirmParams>(value: V, params: P & ParamsCheck<P>): boolean
  /**
   * Evaluates every check and reports all failures, with paths like `items[2].id`.
   * Never throws on data failures. Reports describe values by type only (`string(len 2)`),
   * never by content, so they are safe to log.
   *
   * @example
   * const report = affirm.explain(body, { shape: { email: { matches: /@/ } } })
   * if (!report.ok) log.warn(report.failures.map((f) => f.reason))
   */
  explain<const P extends AffirmParams>(value: unknown, params: P & ParamsCheck<P>): AffirmReport
  /**
   * Throws `AffirmError` (with the full report) unless every check passes; afterwards `value`
   * is narrowed for the rest of the scope.
   *
   * @example
   * affirm.assert(config.port, { isInteger: true, isBetween: [1, 65535] }, 'invalid PORT')
   * server.listen(config.port) // number
   */
  assert<V, const P extends AffirmParams>(
    value: V,
    params: P & ParamsCheck<P> & IfNarrowable<V, P>,
    message?: string,
  ): asserts value is Affirmed<V, P>
  /**
   * Throws `AffirmError` (with the full report) unless every check passes.
   * (This signature is used when narrowing would be unsound.)
   *
   * @example
   * affirm.assert(input, { isFalsy: true }, 'expected no input')
   */
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
/**
 * Replaces compound data checks with one readable object of named checks.
 * See `AffirmParams` for every key, and `AGENTS.md` for the usage guide.
 *
 * @example
 * import { affirm } from 'assert'
 *
 * if (affirm(user, { isPresent: true, hasKey: 'email' })) { … }
 * affirm.explain(user, { shape: { email: { matches: /@/ } } }) // { ok, failures }
 * affirm.assert(user, { isPresent: true }) // throws AffirmError, then narrows
 */
export const affirm: Affirm = Object.assign(call, { explain, assert: assertOrThrow }) as Affirm

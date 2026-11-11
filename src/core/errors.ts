import type { AffirmReport } from './report'

const MAX_REASONS = 3

/**
 * Thrown by `affirm.assert` when data fails its checks (design §9). `report` has every failure.
 * The default message lists the first three reasons, then `(+N more)`.
 *
 * @example
 * try {
 *   affirm.assert(body, { shape: { email: { matches: /@/ } } })
 * } catch (error) {
 *   if (error instanceof AffirmError) return badRequest(error.report.failures)
 *   throw error
 * }
 */
export class AffirmError extends Error {
  override readonly name = 'AffirmError'
  readonly report: AffirmReport

  constructor(report: AffirmReport, message?: string) {
    super(message ?? defaultMessage(report))
    this.report = report
  }
}

function defaultMessage(report: AffirmReport): string {
  const reasons = report.failures.slice(0, MAX_REASONS).map((f) => f.reason)
  const more = report.failures.length - reasons.length
  return `affirm.assert failed: ${reasons.join('; ')}${more > 0 ? ` (+${more} more)` : ''}`
}

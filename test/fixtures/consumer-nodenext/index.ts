// Fails to compile if the published types don't resolve under NodeNext:
// `affirm` would lose its signature and `order` would stay `unknown`.
import { affirm, AffirmError, type Affirmed, type AffirmParams, type AffirmReport } from '@frankmeza/affirm'
import affirmEslint from '@frankmeza/affirm/eslint'

export function getTotal(order: unknown): number | undefined {
  if (affirm(order, { shape: { total: { isType: 'number', isPositive: true } } })) {
    return order.total
  }
  return undefined
}

export function requireName(value: unknown): string {
  affirm.assert(value, { isType: 'string', isBlank: false })
  return value
}

const report: AffirmReport = affirm.explain(42, { isType: 'string' })
export const reasons: readonly string[] = report.failures.map((f) => f.reason)

const roleParams = { isOneOf: ['admin', 'user'] } as const satisfies AffirmParams
export type Role = Affirmed<unknown, typeof roleParams>
export const role: Role = 'admin'

export const isAffirmError = (e: unknown): e is AffirmError => e instanceof AffirmError
export const recommended: object = affirmEslint.configs.recommended

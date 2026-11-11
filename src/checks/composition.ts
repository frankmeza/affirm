import { composite, formatParams, functionParam, leaf, Phase, type CheckGroup, type ValidateNested } from '../core/check-def'
import { makeFailure, type AffirmFailure } from '../core/report'
import type { CompositionParams } from '../types/composition'
import type { AffirmParams } from '../types/params'

function validateBranches(param: unknown, path: string, validateNested: ValidateNested): string | undefined {
  if (!Array.isArray(param) || param.length === 0) return 'a non-empty array of params'
  for (const branch of param) validateNested(branch, path)
  return undefined
}

export const compositionChecks = {
  not: composite<AffirmParams>({
    phase: Phase.Structural,
    validateParam: (param, path, validateNested) => {
      validateNested(param, path)
      return undefined
    },
    evaluate(value, params, ctx) {
      return ctx.test(value, params) ? [makeFailure(ctx.key, ctx.path, `not ${formatParams(params)}`, value)] : []
    },
  }),

  /**
   * Passes when any branch passes. The failure lists every branch's failures in `branches`
   * (all of them under `explain()`, the first per branch under `affirm()`).
   */
  anyOf: composite<readonly AffirmParams[]>({
    phase: Phase.Structural,
    validateParam: validateBranches,
    evaluate(value, branches, ctx) {
      const branchFailures: AffirmFailure[][] = []
      for (const branch of branches) {
        const failures = ctx.run(value, branch, ctx.path)
        if (failures.length === 0) return []
        branchFailures.push(failures)
      }
      const n = branches.length
      const failure = makeFailure(ctx.key, ctx.path, `any of ${n} ${n === 1 ? 'branch' : 'branches'} to pass`, value)
      return [{ ...failure, branches: branchFailures }]
    },
  }),

  satisfies: leaf<(value: unknown) => boolean>({
    phase: Phase.Predicate,
    validateParam: functionParam,
    test: (value, predicate) => predicate(value) === true,
    expected: (predicate) => `${predicate.name || 'predicate'}(value) to return true`,
  }),
} satisfies CheckGroup<CompositionParams>

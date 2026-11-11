import {
  anyParam,
  arrayParam,
  composite,
  formatParams,
  leaf,
  Phase,
  type CheckGroup,
  type ValidateNested,
} from '../core/check-def'
import { formatList, formatParam } from '../core/describe'
import { joinPath, makeFailure, type AffirmFailure } from '../core/report'
import { isArray } from '../core/util/kind'
import type { ArrayParams } from '../types/arrays'
import type { AffirmParams } from '../types/params'

/** Nested item params are validated once, at `items[*]`. */
const validateItemParams = (param: unknown, path: string, validateNested: ValidateNested): undefined => {
  validateNested(param, `${path}[*]`)
  return undefined
}

// Array.prototype.includes uses SameValueZero (design §4 rule 8).
export const arrayChecks = {
  contains: leaf<unknown, readonly unknown[]>({
    phase: Phase.Measure,
    validateParam: anyParam,
    accepts: isArray,
    acceptsLabel: 'an array',
    test: (value, item) => value.includes(item),
    expected: (item) => `an array containing ${formatParam(item)}`,
  }),

  containsAll: leaf<readonly unknown[], readonly unknown[]>({
    phase: Phase.Measure,
    validateParam: arrayParam,
    accepts: isArray,
    acceptsLabel: 'an array',
    test: (value, items) => items.every((item) => value.includes(item)),
    expected: (items) => `an array containing all of ${formatList(items)}`,
  }),

  containsAny: leaf<readonly unknown[], readonly unknown[]>({
    phase: Phase.Measure,
    validateParam: arrayParam,
    accepts: isArray,
    acceptsLabel: 'an array',
    test: (value, items) => items.some((item) => value.includes(item)),
    expected: (items) => `an array containing any of ${formatList(items)}`,
  }),

  /** Failures carry the item path: `items[2].id`. Vacuously true on `[]`. */
  everyItem: composite<AffirmParams, readonly unknown[]>({
    phase: Phase.Structural,
    validateParam: validateItemParams,
    accepts: isArray,
    acceptsLabel: 'an array',
    evaluate(value, params, ctx) {
      const failures: AffirmFailure[] = []
      for (let i = 0; i < value.length; i++) {
        failures.push(...ctx.run(value[i], params, joinPath(ctx.path, i)))
        if (ctx.mode === 'first' && failures.length > 0) break
      }
      return failures
    },
  }),

  /** One failure when no item passes (per-item failures would just be noise). False on `[]`. */
  someItem: composite<AffirmParams, readonly unknown[]>({
    phase: Phase.Structural,
    validateParam: validateItemParams,
    accepts: isArray,
    acceptsLabel: 'an array',
    evaluate(value, params, ctx) {
      if (value.some((item) => ctx.test(item, params))) return []
      return [makeFailure(ctx.key, ctx.path, `at least one item passing ${formatParams(params)}`, value)]
    },
  }),
} satisfies CheckGroup<ArrayParams>

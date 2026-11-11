import { anyParam, arrayParam, leaf, Phase, type CheckGroup } from '../core/check-def'
import { formatList, formatParam } from '../core/describe'
import { isArray } from '../core/util/kind'
import type { ArrayParams } from '../types/arrays'

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
} satisfies CheckGroup<ArrayParams>

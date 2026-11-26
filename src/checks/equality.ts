import { anyParam, arrayParam, leaf, Phase, type CheckGroup } from '../core/check-def.js'
import { formatList, formatParam } from '../core/describe.js'
import { deepEqual } from '../core/util/deep-equal.js'
import type { EqualityParams } from '../types/equality.js'

export const equalityChecks = {
  is: leaf<unknown>({
    phase: Phase.Kind,
    validateParam: anyParam,
    test: (value, param) => value === param,
    expected: (param) => `=== ${formatParam(param)}`,
  }),

  isNot: leaf<unknown>({
    phase: Phase.Kind,
    validateParam: anyParam,
    test: (value, param) => value !== param,
    expected: (param) => `!== ${formatParam(param)}`,
  }),

  // Array.prototype.includes uses SameValueZero (rule 8).
  isOneOf: leaf<readonly unknown[]>({
    phase: Phase.Kind,
    validateParam: arrayParam,
    test: (value, list) => list.includes(value),
    expected: (list) => `one of ${formatList(list)}`,
  }),

  isNotOneOf: leaf<readonly unknown[]>({
    phase: Phase.Kind,
    validateParam: arrayParam,
    test: (value, list) => !list.includes(value),
    expected: (list) => `none of ${formatList(list)}`,
  }),

  isDeepEqual: leaf<unknown>({
    phase: Phase.Structural,
    validateParam: anyParam,
    test: (value, param) => deepEqual(value, param),
    expected: (param) => `deep equal to ${formatParam(param)}`,
  }),
} satisfies CheckGroup<EqualityParams>

import { booleanLeaf, leaf, numberParam, Phase, type CheckDef, type CheckGroup } from '../core/check-def.js'
import { formatParam } from '../core/describe.js'
import { isNumberNotNaN } from '../core/util/kind.js'
import type { NumberParams } from '../types/numbers.js'

const NUMBER = 'a number (not NaN)'

/** A comparison key: `value <op> n`. */
function compare(test: (value: number, n: number) => boolean, op: string): CheckDef<number> {
  return leaf<number, number>({
    phase: Phase.Measure,
    validateParam: numberParam,
    accepts: isNumberNotNaN,
    acceptsLabel: NUMBER,
    test,
    expected: (n) => `${op} ${formatParam(n)}`,
  })
}

function validateRange(param: unknown): string | undefined {
  if (
    !Array.isArray(param) ||
    param.length !== 2 ||
    numberParam(param[0]) !== undefined ||
    numberParam(param[1]) !== undefined
  ) {
    return `a [min, max] pair of numbers (received ${formatParam(param)})`
  }
  return param[0] <= param[1] ? undefined : `min <= max (received [${param[0]}, ${param[1]}])`
}

function validateDivisor(param: unknown): string | undefined {
  return Number.isFinite(param) && param !== 0 ? undefined : `a finite non-zero number (received ${formatParam(param)})`
}

export const numberChecks = {
  isGreaterThan: compare((v, n) => v > n, '>'),
  isAtLeast: compare((v, n) => v >= n, '>='),
  isLessThan: compare((v, n) => v < n, '<'),
  isAtMost: compare((v, n) => v <= n, '<='),

  // D3: inclusive at both ends.
  isBetween: leaf<readonly [number, number], number>({
    phase: Phase.Measure,
    validateParam: validateRange,
    accepts: isNumberNotNaN,
    acceptsLabel: NUMBER,
    test: (value, [min, max]) => value >= min && value <= max,
    expected: ([min, max]) => `between ${formatParam(min)} and ${formatParam(max)} (inclusive)`,
  }),

  isPositive: booleanLeaf<number>({
    phase: Phase.Measure,
    accepts: isNumberNotNaN,
    acceptsLabel: NUMBER,
    test: (value) => value > 0,
    expected: '> 0',
    expectedNot: '<= 0',
  }),

  isNegative: booleanLeaf<number>({
    phase: Phase.Measure,
    accepts: isNumberNotNaN,
    acceptsLabel: NUMBER,
    test: (value) => value < 0,
    expected: '< 0',
    expectedNot: '>= 0',
  }),

  isMultipleOf: leaf<number, number>({
    phase: Phase.Measure,
    validateParam: validateDivisor,
    accepts: isNumberNotNaN,
    acceptsLabel: NUMBER,
    test: (value, n) => value % n === 0,
    expected: (n) => `a multiple of ${formatParam(n)}`,
  }),
} satisfies CheckGroup<NumberParams>

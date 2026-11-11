import { describe, expect, test } from 'vitest'
import { affirm, type AffirmParams } from '../../src'

const OBJ = {}
const ARR: unknown[] = []
const VALUES = [null, undefined, 0, '', false, Number.NaN, 'x', 1, OBJ, ARR] as const

// [key, values that pass with `true`]
const TABLE: [string, readonly unknown[]][] = [
  ['isNull', [null]],
  ['isUndefined', [undefined]],
  ['isNullish', [null, undefined]],
  ['isDefined', [null, 0, '', false, Number.NaN, 'x', 1, OBJ, ARR]],
  ['isPresent', [0, '', false, Number.NaN, 'x', 1, OBJ, ARR]],
  ['isTruthy', ['x', 1, OBJ, ARR]],
  ['isFalsy', [null, undefined, 0, '', false, Number.NaN]],
]

describe.each(TABLE)('%s', (key, passing) => {
  test.each(VALUES.map((v) => [v]))('value %o', (value) => {
    const shouldPass = passing.includes(value)
    expect(affirm(value, { [key]: true } as AffirmParams)).toBe(shouldPass)
    // D1: `false` is the exact negation (no kind gate for nullish keys)
    expect(affirm(value, { [key]: false } as AffirmParams)).toBe(!shouldPass)
  })
})

test('negated keys read naturally in reports', () => {
  const { failures } = affirm.explain(null, { isNull: false })
  expect(failures).toEqual([
    {
      key: 'isNull',
      path: '',
      expected: 'not null',
      received: 'null',
      reason: 'expected not null, received null',
    },
  ])
})

test('non-boolean param throws', () => {
  expect(() => affirm(null, { isNull: 'yes' as never })).toThrow(/invalid param for `isNull`: expected a boolean/)
})

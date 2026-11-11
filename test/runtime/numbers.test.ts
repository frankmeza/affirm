import { describe, expect, test } from 'vitest'
import { affirm } from '../../src'

describe('comparisons', () => {
  test('>, >=, <, <=', () => {
    expect(affirm(6, { isGreaterThan: 5 })).toBe(true)
    expect(affirm(5, { isGreaterThan: 5 })).toBe(false)
    expect(affirm(5, { isAtLeast: 5 })).toBe(true)
    expect(affirm(4, { isLessThan: 5 })).toBe(true)
    expect(affirm(5, { isLessThan: 5 })).toBe(false)
    expect(affirm(5, { isAtMost: 5 })).toBe(true)
  })

  test('Infinity is a number and compares normally', () => {
    expect(affirm(Infinity, { isGreaterThan: 1e308 })).toBe(true)
  })

  test('no coercion: numeric strings fail (rule 5)', () => {
    expect(affirm('10', { isGreaterThan: 5 })).toBe(false)
    expect(affirm.explain('10', { isGreaterThan: 5 }).failures[0]?.expected).toBe('a number (not NaN)')
  })

  test('NaN fails every number key', () => {
    expect(affirm(Number.NaN, { isGreaterThan: 0 })).toBe(false)
    expect(affirm(Number.NaN, { isAtMost: 0 })).toBe(false)
    expect(affirm(Number.NaN, { isPositive: false })).toBe(false)
  })

  test('param must be a number, not NaN', () => {
    expect(() => affirm(1, { isGreaterThan: '5' as never })).toThrow(TypeError)
    expect(() => affirm(1, { isGreaterThan: Number.NaN })).toThrow(TypeError)
  })
})

describe('isBetween (inclusive, D3)', () => {
  test('both ends included', () => {
    expect(affirm(1, { isBetween: [1, 3] })).toBe(true)
    expect(affirm(3, { isBetween: [1, 3] })).toBe(true)
    expect(affirm(3.01, { isBetween: [1, 3] })).toBe(false)
    expect(affirm(2, { isBetween: [2, 2] })).toBe(true)
  })

  test('expected wording', () => {
    expect(affirm.explain(9, { isBetween: [1, 3] }).failures[0]?.expected).toBe('between 1 and 3 (inclusive)')
  })

  test('bad ranges throw', () => {
    expect(() => affirm(1, { isBetween: [3, 1] })).toThrow(/min <= max/)
    expect(() => affirm(1, { isBetween: [1] as never })).toThrow(TypeError)
    expect(() => affirm(1, { isBetween: [1, '3'] as never })).toThrow(TypeError)
  })
})

describe('isPositive / isNegative', () => {
  test('zero is neither', () => {
    expect(affirm(0, { isPositive: true })).toBe(false)
    expect(affirm(0, { isNegative: true })).toBe(false)
    expect(affirm(0, { isPositive: false })).toBe(true)
    expect(affirm(-0, { isNegative: false })).toBe(true)
  })

  test('D7: false means "a number that is not positive"', () => {
    expect(affirm(-1, { isPositive: false })).toBe(true)
    expect(affirm('x', { isPositive: false })).toBe(false)
    expect(affirm(null, { isNegative: false })).toBe(false)
  })
})

describe('isMultipleOf', () => {
  test('value % n === 0', () => {
    expect(affirm(10, { isMultipleOf: 5 })).toBe(true)
    expect(affirm(-10, { isMultipleOf: 5 })).toBe(true)
    expect(affirm(0, { isMultipleOf: 7 })).toBe(true)
    expect(affirm(11, { isMultipleOf: 5 })).toBe(false)
    expect(affirm(Infinity, { isMultipleOf: 5 })).toBe(false)
  })

  test('zero, non-finite and non-number divisors throw', () => {
    expect(() => affirm(1, { isMultipleOf: 0 })).toThrow(/finite non-zero/)
    expect(() => affirm(1, { isMultipleOf: Infinity })).toThrow(TypeError)
    expect(() => affirm(1, { isMultipleOf: '2' as never })).toThrow(TypeError)
  })
})

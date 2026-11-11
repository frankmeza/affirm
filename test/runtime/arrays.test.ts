import { describe, expect, test } from 'vitest'
import { affirm } from '../../src'

describe('contains / containsAll / containsAny', () => {
  test('SameValueZero membership (rule 8)', () => {
    expect(affirm([1, 2, 3], { contains: 2 })).toBe(true)
    expect(affirm([1, 2, 3], { contains: '2' })).toBe(false)
    expect(affirm([Number.NaN], { contains: Number.NaN })).toBe(true)
    expect(affirm([{ a: 1 }], { contains: { a: 1 } })).toBe(false) // reference, not deep
  })

  test('contains: undefined is a skip, not a search for undefined (rule 3)', () => {
    expect(affirm([1], { contains: undefined, isArray: true })).toBe(true)
  })

  test('containsAll: [] always passes; containsAny: [] never passes', () => {
    expect(affirm(['a', 'b'], { containsAll: ['a', 'b'] })).toBe(true)
    expect(affirm(['a'], { containsAll: ['a', 'b'] })).toBe(false)
    expect(affirm(['a'], { containsAll: [] })).toBe(true)
    expect(affirm(['a'], { containsAny: ['x', 'a'] })).toBe(true)
    expect(affirm(['a'], { containsAny: ['x'] })).toBe(false)
    expect(affirm(['a'], { containsAny: [] })).toBe(false)
  })

  test('arrays only: strings and Sets fail', () => {
    expect(affirm('abc', { contains: 'a' })).toBe(false)
    expect(affirm(new Set([1]), { contains: 1 })).toBe(false)
    expect(affirm.explain('abc', { contains: 'a' }).failures[0]?.expected).toBe('an array')
  })

  test('list params must be arrays', () => {
    expect(() => affirm([], { containsAll: 'ab' as never })).toThrow(TypeError)
  })
})

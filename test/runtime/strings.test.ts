import { describe, expect, test } from 'vitest'
import { affirm } from '../../src'

describe('startsWith / endsWith / includes', () => {
  test('basic', () => {
    expect(affirm('order-123', { startsWith: 'order-' })).toBe(true)
    expect(affirm('order-123', { endsWith: '123' })).toBe(true)
    expect(affirm('order-123', { includes: 'der' })).toBe(true)
    expect(affirm('order-123', { includes: 'xyz' })).toBe(false)
  })

  test('includes is string-only: arrays fail (use contains)', () => {
    expect(affirm(['a', 'b'], { includes: 'a' })).toBe(false)
    expect(affirm.explain(['a'], { includes: 'a' }).failures[0]?.expected).toBe('a string')
  })

  test('param must be a string', () => {
    expect(() => affirm('a', { startsWith: 1 as never })).toThrow(TypeError)
  })
})

describe('matches', () => {
  test('basic', () => {
    expect(affirm('abc123', { matches: /^[a-z]+\d+$/ })).toBe(true)
    expect(affirm('123abc', { matches: /^[a-z]+\d+$/ })).toBe(false)
  })

  test('/g and /y regexes are stateless across calls', () => {
    const re = /a/g
    expect(affirm('a', { matches: re })).toBe(true)
    expect(affirm('a', { matches: re })).toBe(true)
    const sticky = /a/y
    expect(affirm('a', { matches: sticky })).toBe(true)
    expect(affirm('a', { matches: sticky })).toBe(true)
  })

  test('string param throws with a hint (rule 6)', () => {
    expect(() => affirm('abc', { matches: 'abc' as never })).toThrow(/a RegExp .*use `includes`/)
  })

  test('long regexes are truncated in expected', () => {
    const re = new RegExp('a'.repeat(60))
    expect(affirm.explain('b', { matches: re }).failures[0]?.expected).toMatch(/^a string matching \/a+…$/)
  })

  test('non-strings fail', () => {
    expect(affirm(123, { matches: /\d+/ })).toBe(false)
  })
})

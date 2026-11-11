import { describe, expect, test } from 'vitest'
import { affirm } from '../../src'

describe('is / isNot', () => {
  test('strict equality', () => {
    expect(affirm('admin', { is: 'admin' })).toBe(true)
    expect(affirm('Admin', { is: 'admin' })).toBe(false)
    expect(affirm(1, { is: '1' })).toBe(false)
    expect(affirm(null, { is: null })).toBe(true)
    expect(affirm(Number.NaN, { is: Number.NaN })).toBe(false) // === semantics
    expect(affirm(-0, { is: 0 })).toBe(true)
  })

  test('objects compare by reference', () => {
    const obj = { a: 1 }
    expect(affirm(obj, { is: obj })).toBe(true)
    expect(affirm({ a: 1 }, { is: { a: 1 } })).toBe(false)
  })

  test('isNot', () => {
    expect(affirm('guest', { isNot: 'admin' })).toBe(true)
    expect(affirm('admin', { isNot: 'admin' })).toBe(false)
  })

  test('is: null is a real check, not a skip', () => {
    expect(affirm(undefined, { is: null })).toBe(false)
  })

  test('expected wording', () => {
    expect(affirm.explain('x', { is: 'admin' }).failures[0]?.expected).toBe('=== "admin"')
  })
})

describe('isOneOf / isNotOneOf', () => {
  test('SameValueZero membership', () => {
    expect(affirm('b', { isOneOf: ['a', 'b'] })).toBe(true)
    expect(affirm('c', { isOneOf: ['a', 'b'] })).toBe(false)
    expect(affirm(Number.NaN, { isOneOf: [1, Number.NaN] })).toBe(true)
    expect(affirm(-0, { isOneOf: [0] })).toBe(true)
  })

  test('empty list never passes isOneOf, always passes isNotOneOf', () => {
    expect(affirm('a', { isOneOf: [] })).toBe(false)
    expect(affirm('a', { isNotOneOf: [] })).toBe(true)
  })

  test('isNotOneOf', () => {
    expect(affirm('c', { isNotOneOf: ['a', 'b'] })).toBe(true)
    expect(affirm(Number.NaN, { isNotOneOf: [Number.NaN] })).toBe(false)
  })

  test('long lists are truncated in expected', () => {
    const { failures } = affirm.explain(0, { isOneOf: [1, 2, 3, 4, 5, 6, 7] })
    expect(failures[0]?.expected).toBe('one of [1, 2, 3, 4, 5, … (+2)]')
  })

  test('non-array param throws', () => {
    expect(() => affirm('a', { isOneOf: 'abc' as never })).toThrow(TypeError)
  })
})

describe('isDeepEqual', () => {
  test('passes on structurally equal values', () => {
    expect(affirm({ a: [1, { b: 2 }] }, { isDeepEqual: { a: [1, { b: 2 }] } })).toBe(true)
    expect(affirm({ a: 1 }, { isDeepEqual: { a: 2 } })).toBe(false)
  })
})

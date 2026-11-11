import { describe, expect, test } from 'vitest'
import { deepEqual } from '../../src/core/util/deep-equal'

describe('deepEqual (design §7)', () => {
  test('primitives: Object.is, except +0 equals -0', () => {
    expect(deepEqual(1, 1)).toBe(true)
    expect(deepEqual(Number.NaN, Number.NaN)).toBe(true)
    expect(deepEqual(0, -0)).toBe(true)
    expect(deepEqual(1, '1')).toBe(false)
    expect(deepEqual(null, undefined)).toBe(false)
  })

  test('arrays: same length, elementwise', () => {
    expect(deepEqual([1, [2, 3]], [1, [2, 3]])).toBe(true)
    expect(deepEqual([1, 2], [1, 2, 3])).toBe(false)
    expect(deepEqual([1, 2], [2, 1])).toBe(false)
  })

  test('same type required: array vs object with same keys', () => {
    expect(deepEqual([1], { 0: 1 })).toBe(false)
    expect(deepEqual({ 0: 1 }, [1])).toBe(false)
  })

  test('plain objects: same own enumerable keys, key order irrelevant', () => {
    expect(deepEqual({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true)
    expect(deepEqual({ a: 1 }, { a: 1, b: undefined })).toBe(false)
    expect(deepEqual({ a: undefined }, { b: undefined })).toBe(false)
  })

  test('null-prototype objects count as plain', () => {
    const a = Object.assign(Object.create(null), { x: 1 })
    expect(deepEqual(a, { x: 1 })).toBe(true)
  })

  test('Date and RegExp', () => {
    expect(deepEqual(new Date(5), new Date(5))).toBe(true)
    expect(deepEqual(new Date(5), new Date(6))).toBe(false)
    expect(deepEqual(new Date(Number.NaN), new Date(Number.NaN))).toBe(true)
    expect(deepEqual(/a/g, /a/g)).toBe(true)
    expect(deepEqual(/a/g, /a/i)).toBe(false)
  })

  test('Map: same keys (SameValueZero), deep values', () => {
    expect(deepEqual(new Map([['a', { x: 1 }]]), new Map([['a', { x: 1 }]]))).toBe(true)
    expect(deepEqual(new Map([['a', 1]]), new Map([['b', 1]]))).toBe(false)
    expect(deepEqual(new Map([[Number.NaN, 1]]), new Map([[Number.NaN, 1]]))).toBe(true)
  })

  test('Set: membership by SameValueZero, objects not matched deeply (v1)', () => {
    expect(deepEqual(new Set([1, 2]), new Set([2, 1]))).toBe(true)
    expect(deepEqual(new Set([1]), new Set([2]))).toBe(false)
    expect(deepEqual(new Set([{ a: 1 }]), new Set([{ a: 1 }]))).toBe(false)
  })

  test('class instances: reference equality only', () => {
    class Point {
      x: number
      constructor(x: number) {
        this.x = x
      }
    }
    const p = new Point(1)
    expect(deepEqual(p, p)).toBe(true)
    expect(deepEqual(new Point(1), new Point(1))).toBe(false)
  })

  test('cycles terminate', () => {
    type Node = { name: string; self?: Node }
    const a: Node = { name: 'n' }
    a.self = a
    const b: Node = { name: 'n' }
    b.self = b
    expect(deepEqual(a, b)).toBe(true)
    const c: Node = { name: 'other' }
    c.self = c
    expect(deepEqual(a, c)).toBe(false)
  })
})

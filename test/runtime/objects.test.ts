import { describe, expect, test } from 'vitest'
import { affirm } from '../../src'

describe('hasKey / hasKeys / hasAnyKey', () => {
  test('own keys only (D2)', () => {
    expect(affirm({ total: 1 }, { hasKey: 'total' })).toBe(true)
    expect(affirm({ total: undefined }, { hasKey: 'total' })).toBe(true) // present, even if undefined
    expect(affirm({}, { hasKey: 'toString' })).toBe(false) // inherited
    class Order {
      get total() {
        return 1
      }
    }
    expect(affirm(new Order(), { hasKey: 'total' })).toBe(false) // prototype getter → use satisfies
  })

  test('Object.create(null) objects work (Q2)', () => {
    const bare = Object.assign(Object.create(null), { id: 1 })
    expect(affirm(bare, { hasKey: 'id' })).toBe(true)
    expect(affirm(bare, { hasKeys: ['id'], hasOnlyKeys: ['id'], hasPath: 'id' })).toBe(true)
  })

  test('arrays and numeric keys', () => {
    expect(affirm(['a'], { hasKey: 0 })).toBe(true)
    expect(affirm(['a'], { hasKey: '0' })).toBe(true)
    expect(affirm(['a'], { hasKey: 1 })).toBe(false)
  })

  test('symbol keys', () => {
    const id = Symbol('id')
    expect(affirm({ [id]: 1 }, { hasKey: id })).toBe(true)
  })

  test('hasKeys needs all, hasAnyKey needs one', () => {
    const value = { a: 1, b: 2 }
    expect(affirm(value, { hasKeys: ['a', 'b'] })).toBe(true)
    expect(affirm(value, { hasKeys: ['a', 'c'] })).toBe(false)
    expect(affirm(value, { hasKeys: [] })).toBe(true)
    expect(affirm(value, { hasAnyKey: ['c', 'b'] })).toBe(true)
    expect(affirm(value, { hasAnyKey: ['c'] })).toBe(false)
    expect(affirm(value, { hasAnyKey: [] })).toBe(false)
  })

  test('non-objects fail: null, primitives, functions', () => {
    expect(affirm(null, { hasKey: 'a' })).toBe(false)
    expect(affirm('abc', { hasKey: 'length' })).toBe(false)
    expect(affirm(() => 1, { hasKey: 'name' })).toBe(false)
    expect(affirm.explain(null, { hasKey: 'a' }).failures[0]?.expected).toBe('an object or array')
  })

  test('bad params throw', () => {
    expect(() => affirm({}, { hasKey: {} as never })).toThrow(TypeError)
    expect(() => affirm({}, { hasKeys: 'a' as never })).toThrow(TypeError)
    expect(() => affirm({}, { hasKeys: ['a', null] as never })).toThrow(TypeError)
  })
})

describe('hasOnlyKeys', () => {
  test('no own key outside the list; does not require presence', () => {
    expect(affirm({ a: 1 }, { hasOnlyKeys: ['a', 'b'] })).toBe(true)
    expect(affirm({}, { hasOnlyKeys: ['a'] })).toBe(true)
    expect(affirm({ a: 1, c: 3 }, { hasOnlyKeys: ['a', 'b'] })).toBe(false)
  })

  test('numeric keys match their string form; symbols count', () => {
    expect(affirm({ 1: 'x' }, { hasOnlyKeys: [1] })).toBe(true)
    const s = Symbol('s')
    expect(affirm({ a: 1, [s]: 1 }, { hasOnlyKeys: ['a'] })).toBe(false)
    expect(affirm({ a: 1, [s]: 1 }, { hasOnlyKeys: ['a', s] })).toBe(true)
  })

  test('non-enumerable keys are ignored', () => {
    const value = Object.defineProperty({ a: 1 }, 'hidden', { value: 1, enumerable: false })
    expect(affirm(value, { hasOnlyKeys: ['a'] })).toBe(true)
  })
})

describe('hasPath', () => {
  const order = { user: { address: { zip: '12345' } }, items: [{ id: 'i1' }] }

  test('nested own keys and array indexes', () => {
    expect(affirm(order, { hasPath: 'user.address.zip' })).toBe(true)
    expect(affirm(order, { hasPath: 'items.0.id' })).toBe(true)
    expect(affirm(order, { hasPath: 'items.1.id' })).toBe(false)
    expect(affirm(order, { hasPath: 'user.phone' })).toBe(false)
  })

  test('stops at null and primitives', () => {
    expect(affirm({ user: null }, { hasPath: 'user.name' })).toBe(false)
    expect(affirm({ name: 'abc' }, { hasPath: 'name.length' })).toBe(false)
  })

  test('a leaf that exists but is undefined passes', () => {
    expect(affirm({ a: { b: undefined } }, { hasPath: 'a.b' })).toBe(true)
  })

  test('malformed paths throw', () => {
    expect(() => affirm({}, { hasPath: '' })).toThrow(/no empty segments/)
    expect(() => affirm({}, { hasPath: 'a..b' })).toThrow(/no empty segments/)
    expect(() => affirm({}, { hasPath: ['a'] as never })).toThrow(TypeError)
  })
})

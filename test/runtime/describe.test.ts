import { expect, test } from 'vitest'
import { describe as describeValue, formatParam } from '../../src/core/describe'
import { joinPath } from '../../src/core/report'

test.each([
  [null, 'null'],
  [undefined, 'undefined'],
  ['ab', 'string(len 2)'],
  [1, 'number'],
  [Number.NaN, 'number(NaN)'],
  [true, 'boolean'],
  [1n, 'bigint'],
  [Symbol('s'), 'symbol'],
  [() => 1, 'function'],
  [[1, 2, 3, 4], 'array(len 4)'],
  [new Date(0), 'Date'],
  [new Date('nope'), 'Date(invalid)'],
  [new Map(), 'Map(size 0)'],
  [new Set([1]), 'Set(size 1)'],
  [/x/, 'RegExp'],
  [{ a: 1, b: 2, c: 3 }, 'object{3 keys}'],
  [{ a: 1 }, 'object{1 key}'],
  [Object.create(null), 'object{0 keys}'],
  [new (class Order { id = 1 })(), 'Order{1 key}'],
])('describe(%o) → %s', (value, expected) => {
  expect(describeValue(value)).toBe(expected)
})

test('formatParam shows short literals, describes the rest', () => {
  expect(formatParam('admin')).toBe('"admin"')
  expect(formatParam('x'.repeat(40))).toBe('string(len 40)')
  expect(formatParam(-0)).toBe('-0')
  expect(formatParam(5n)).toBe('5n')
  expect(formatParam(null)).toBe('null')
  expect(formatParam({ a: 1 })).toBe('object{1 key}')
})

test('joinPath', () => {
  expect(joinPath('', 'user')).toBe('user')
  expect(joinPath('user', 'zip')).toBe('user.zip')
  expect(joinPath('items', 2)).toBe('items[2]')
  expect(joinPath('items[2]', 'id')).toBe('items[2].id')
})

import { describe, expect, test } from 'vitest'
import { affirm } from '../../src'

describe('isEmpty / isNotEmpty', () => {
  test.each([
    ['', true],
    ['a', false],
    [[], true],
    [[0], false],
    [new Map(), true],
    [new Map([[1, 1]]), false],
    [new Set(), true],
    [new Set([1]), false],
    [{}, true],
    [{ a: 1 }, false],
    [Object.create(null), true],
  ])('%o → empty: %s', (value, empty) => {
    expect(affirm(value, { isEmpty: true })).toBe(empty)
    expect(affirm(value, { isEmpty: false })).toBe(!empty)
    expect(affirm(value, { isNotEmpty: true })).toBe(!empty)
    expect(affirm(value, { isNotEmpty: false })).toBe(empty)
  })

  test.each([null, undefined, 0, 1, true, new Date(), new (class {})()])(
    'non-measurable %o fails every polarity (D7)',
    (value) => {
      expect(affirm(value, { isEmpty: true })).toBe(false)
      expect(affirm(value, { isEmpty: false })).toBe(false)
      expect(affirm(value, { isNotEmpty: true })).toBe(false)
      expect(affirm(value, { isNotEmpty: false })).toBe(false)
    },
  )

  test('"null or empty" via anyOf is documented, isEmpty(null) itself fails', () => {
    expect(affirm.explain(null, { isEmpty: true }).failures[0]?.expected).toBe(
      'a string, array, Map, Set or plain object',
    )
  })
})

describe('isBlank', () => {
  test('whitespace-only strings', () => {
    expect(affirm('', { isBlank: true })).toBe(true)
    expect(affirm(' \n\t', { isBlank: true })).toBe(true)
    expect(affirm(' a ', { isBlank: true })).toBe(false)
    expect(affirm(' a ', { isBlank: false })).toBe(true)
  })

  test('non-strings fail both polarities', () => {
    expect(affirm(null, { isBlank: true })).toBe(false)
    expect(affirm([], { isBlank: false })).toBe(false)
  })
})

describe('hasLength / hasMinLength / hasMaxLength', () => {
  test('strings, arrays, Maps, Sets', () => {
    expect(affirm('abc', { hasLength: 3 })).toBe(true)
    expect(affirm([1, 2], { hasLength: 3 })).toBe(false)
    expect(affirm(new Map([[1, 1]]), { hasMinLength: 1 })).toBe(true)
    expect(affirm(new Set([1, 2, 3]), { hasMaxLength: 2 })).toBe(false)
    expect(affirm('ab', { hasMinLength: 2, hasMaxLength: 2 })).toBe(true)
  })

  test('plain objects and numbers are not measurable (rule 5)', () => {
    expect(affirm({ a: 1 }, { hasLength: 1 })).toBe(false)
    expect(affirm(123, { hasMinLength: 3 })).toBe(false)
    expect(affirm.explain(123, { hasMinLength: 3 }).failures[0]?.reason).toBe(
      'expected a string, array, Map or Set, received number',
    )
  })

  test('design example wording', () => {
    expect(affirm.explain('ab', { hasMinLength: 3 }).failures[0]?.reason).toBe(
      'expected length >= 3, received string(len 2)',
    )
  })

  test.each([-1, 1.5, '3', Number.NaN])('param %o throws', (n) => {
    expect(() => affirm('abc', { hasMinLength: n as never })).toThrow(/non-negative integer/)
  })
})

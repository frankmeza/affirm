// M5: Standard Schema narrowing (design §10) and contradiction detection (design §6.4).
import { describe, expectTypeOf, test } from 'vitest'
import { affirm } from '../../src'
import type { StandardSchemaV1 } from '../../src/core/util/standard-schema'
import type { GreaterThan } from '../../src/types/contradictions'
import type { Refined } from '../../src/types/narrowing'

declare function value<T>(): T

describe('isType with a Standard Schema', () => {
  test('narrows to the schema input type (refined)', () => {
    const userSchema = value<StandardSchemaV1<{ id: string }>>()
    const x = value<unknown>()
    if (affirm(x, { isType: userSchema })) expectTypeOf(x).toEqualTypeOf<{ id: string } & Refined>()
  })

  test('input, not output: affirm never transforms the value', () => {
    const toNumber = value<StandardSchemaV1<string, number>>()
    const x = value<unknown>()
    if (affirm(x, { isType: toNumber })) expectTypeOf(x).toEqualTypeOf<string & Refined>()
  })

  test('else branch keeps everything', () => {
    const s = value<StandardSchemaV1<string>>()
    const x = value<string | number>()
    if (!affirm(x, { isType: s })) expectTypeOf(x).toEqualTypeOf<string | number>()
  })

  test('nullable schemas fall back to boolean (refined + null)', () => {
    const s = value<StandardSchemaV1<string | null>>()
    const x = value<unknown>()
    if (affirm(x, { isType: s })) expectTypeOf(x).toEqualTypeOf<unknown>()
  })
})

describe('contradictions are compile errors (§6.4)', () => {
  const x = value<unknown>()

  test('nullish rules', () => {
    // @ts-expect-error isNull + isPresent
    affirm(x, { isNull: true, isPresent: true })
    // @ts-expect-error isNull + isTruthy
    affirm(x, { isNull: true, isTruthy: true })
    // @ts-expect-error isNull + isUndefined
    affirm(x, { isNull: true, isUndefined: true })
    // @ts-expect-error isNull + isType tag
    affirm(x, { isNull: true, isType: 'string' })
    // @ts-expect-error isUndefined + isDefined
    affirm(x, { isUndefined: true, isDefined: true })
    // @ts-expect-error isUndefined + isType tag
    affirm(x, { isUndefined: true, isType: 'object' })
    // @ts-expect-error isNullish + isPresent
    affirm(x, { isNullish: true, isPresent: true })
    // @ts-expect-error isTruthy + isFalsy
    affirm(x, { isTruthy: true, isFalsy: true })
  })

  test('size rules', () => {
    // @ts-expect-error isEmpty + isNotEmpty
    affirm(x, { isEmpty: true, isNotEmpty: true })
    // @ts-expect-error isEmpty + hasMinLength >= 1
    affirm(x, { isEmpty: true, hasMinLength: 1 })
    // @ts-expect-error min > max
    affirm(x, { hasMinLength: 10, hasMaxLength: 9 })
    // @ts-expect-error min > max, multi-digit
    affirm(x, { hasMinLength: 130, hasMaxLength: 129 })
  })

  test('kind rules', () => {
    // @ts-expect-error isArray + non-object tag
    affirm(x, { isArray: true, isType: 'string' })
    // @ts-expect-error string + number key
    affirm(x, { isType: 'string', isGreaterThan: 1 })
    // @ts-expect-error string + gated number key with false (D7: fails both polarities)
    affirm(x, { isType: 'string', isInteger: false })
    // @ts-expect-error number + string key
    affirm(x, { isType: 'number', startsWith: 'a' })
  })

  test('contradictions inside nested params', () => {
    // @ts-expect-error inside a shape field
    affirm(x, { shape: { a: { isNull: true, isPresent: true } } })
    // @ts-expect-error inside everyItem
    affirm(x, { everyItem: { isTruthy: true, isFalsy: true } })
    // @ts-expect-error inside an anyOf branch
    affirm(x, { anyOf: [{ isNull: true }, { isType: 'number', matches: /1/ }] })
  })

  test('affirm.explain and affirm.assert check too', () => {
    // @ts-expect-error explain
    affirm.explain(x, { isNull: true, isPresent: true })
    // @ts-expect-error assert
    affirm.assert(x, { isNull: true, isPresent: true })
  })
})

describe('no false positives', () => {
  const x = value<unknown>()

  test('negations and compatible combinations compile', () => {
    affirm(x, { isNull: false, isPresent: true })
    affirm(x, { isNull: true, isDefined: true }) // null is defined (≠ undefined)
    affirm(x, { isNullish: true, isPresent: false })
    affirm(x, { isTruthy: true, isFalsy: false })
    affirm(x, { isEmpty: true, hasMinLength: 0 })
    affirm(x, { isEmpty: false, hasMinLength: 5 })
    affirm(x, { hasMinLength: 3, hasMaxLength: 3 })
    affirm(x, { hasMinLength: 9, hasMaxLength: 10 })
    affirm(x, { isArray: true, isType: 'object' })
    affirm(x, { isType: 'string', hasMinLength: 3, isBlank: false })
    affirm(x, { isType: 'number', isGreaterThan: 1, isInteger: true })
  })

  test('guards and schemas are not tags: they may allow null', () => {
    const isNullish = (v: unknown): v is null | undefined => v == null
    affirm(x, { isNull: true, isType: isNullish })
    affirm(x, { isNull: true, isType: value<StandardSchemaV1<null>>() })
  })

  test('non-literal numbers are never compared', () => {
    const n = value<number>()
    affirm(x, { hasMinLength: n, hasMaxLength: 1 })
    affirm(x, { isEmpty: true, hasMinLength: n })
  })

  test('the same key in different composites is not a contradiction', () => {
    affirm(x, { anyOf: [{ isNull: true }, { isPresent: true }] })
    affirm(x, { isPresent: true, not: { isNull: true } })
  })
})

describe('GreaterThan (non-negative integer literals)', () => {
  test('compares by length, then digit by digit', () => {
    expectTypeOf<GreaterThan<10, 9>>().toEqualTypeOf<true>()
    expectTypeOf<GreaterThan<9, 10>>().toEqualTypeOf<false>()
    expectTypeOf<GreaterThan<130, 129>>().toEqualTypeOf<true>()
    expectTypeOf<GreaterThan<123, 129>>().toEqualTypeOf<false>()
    expectTypeOf<GreaterThan<5, 5>>().toEqualTypeOf<false>()
    expectTypeOf<GreaterThan<1, 0>>().toEqualTypeOf<true>()
  })

  test('wide, negative and decimal numbers are never "greater"', () => {
    expectTypeOf<GreaterThan<number, 1>>().toEqualTypeOf<false>()
    expectTypeOf<GreaterThan<1.5, 1>>().toEqualTypeOf<false>()
    expectTypeOf<GreaterThan<-1, -2>>().toEqualTypeOf<false>()
  })
})

// M2 gate (design §6.3): (a) if-branch narrows, (b) refined else keeps everything,
// (c) exact else excludes, (d) branded values are usable as the unbranded type,
// (e) the resulting types are readable.
import { describe, expectTypeOf, test } from 'vitest'
import { affirm, type AffirmParams, type AffirmReport } from '../../src'
import type { Affirmed } from '../../src/types/affirmed'
import type { AnyFunction } from '../../src/types/runtime-type'
import type { Refined } from '../../src/types/narrowing'

declare function value<T>(): T

type User = { id: string }
const isUser = (v: unknown): v is User => typeof v === 'object' && v !== null && 'id' in v

describe('(a) the if branch narrows', () => {
  test('nullish keys', () => {
    const x = value<string | null | undefined>()
    if (affirm(x, { isPresent: true })) expectTypeOf(x).toEqualTypeOf<string>()
    if (affirm(x, { isNull: true })) expectTypeOf(x).toEqualTypeOf<null>()
    if (affirm(x, { isNullish: false })) expectTypeOf(x).toEqualTypeOf<string>()
    if (affirm(x, { isDefined: true })) expectTypeOf(x).toEqualTypeOf<string | null>()
  })

  test('unknown input', () => {
    const x = value<unknown>()
    if (affirm(x, { isType: 'string' })) expectTypeOf(x).toEqualTypeOf<string>()
    if (affirm(x, { isType: 'function' })) expectTypeOf(x).toEqualTypeOf<AnyFunction>()
    if (affirm(x, { isType: isUser })) expectTypeOf(x).toEqualTypeOf<User>()
    if (affirm(x, { isNull: false })) expectTypeOf(x).toEqualTypeOf<{} | undefined>()
    if (affirm(x, { isArray: true })) expectTypeOf(x).toEqualTypeOf<readonly unknown[]>()
  })

  test('const P keeps literals', () => {
    const x = value<unknown>()
    if (affirm(x, { is: 'admin' })) expectTypeOf(x).toEqualTypeOf<'admin'>()
    if (affirm(x, { isOneOf: ['a', 'b', 1] })) expectTypeOf(x).toEqualTypeOf<'a' | 'b' | 1>()
  })

  test('refined keys narrow too, with the brand', () => {
    const x = value<unknown>()
    if (affirm(x, { isType: 'object' })) expectTypeOf(x).toEqualTypeOf<object & Refined>()
    if (affirm(x, { isInstanceOf: Date })) expectTypeOf(x).toEqualTypeOf<Date & Refined>()
    if (affirm(x, { isInteger: true })) expectTypeOf(x).toEqualTypeOf<number & Refined>()
    // D7: the gated key narrows to its kind in the false polarity too
    if (affirm(x, { isInteger: false })) expectTypeOf(x).toEqualTypeOf<number & Refined>()
  })

  test('keys combine with AND', () => {
    const x = value<string | number | null>()
    if (affirm(x, { isPresent: true, isType: 'string' })) expectTypeOf(x).toEqualTypeOf<string>()
    if (affirm(x, { isType: 'string', isTruthy: true })) expectTypeOf(x).toEqualTypeOf<string & Refined>()
  })

  test('isArray keeps the element type of the input', () => {
    const x = value<string | string[]>()
    if (affirm(x, { isArray: true })) expectTypeOf(x).toEqualTypeOf<string[]>()
  })

  test('affirm.assert narrows the rest of the scope', () => {
    const x = value<string | null>()
    affirm.assert(x, { isPresent: true })
    expectTypeOf(x).toEqualTypeOf<string>()
  })
})

describe('(b) the else branch of a refined check keeps every constituent', () => {
  test('primitives', () => {
    const x = value<string | number>()
    if (!affirm(x, { isType: 'string', isTruthy: true })) expectTypeOf(x).toEqualTypeOf<string | number>()
    if (!affirm(x, { isInteger: true })) expectTypeOf(x).toEqualTypeOf<string | number>()
  })

  test('non-literal `is` is refined', () => {
    const x = value<string | number>()
    const s = value<string>()
    if (!affirm(x, { is: s })) expectTypeOf(x).toEqualTypeOf<string | number>()
  })

  test('{} and object constituents are not swallowed (narrowing uses strict subtyping)', () => {
    const x = value<{} | null>()
    if (!affirm(x, { isTruthy: true })) expectTypeOf(x).toEqualTypeOf<{} | null>()
    const y = value<object | null>()
    if (!affirm(y, { isPlainObject: true })) expectTypeOf(y).toEqualTypeOf<object | null>()
  })

  test('a non-literal boolean param narrows nothing', () => {
    const x = value<string | null>()
    const flag = value<boolean>()
    if (!affirm(x, { isNull: flag })) expectTypeOf(x).toEqualTypeOf<string | null>()
  })

  test('one refined key makes the whole call refined', () => {
    const x = value<string | null>()
    if (!affirm(x, { isNull: false, isTruthy: true })) expectTypeOf(x).toEqualTypeOf<string | null>()
  })
})

describe('(c) the else branch of an exact check excludes correctly', () => {
  test('nullish', () => {
    const x = value<string | null | undefined>()
    if (!affirm(x, { isNull: true })) expectTypeOf(x).toEqualTypeOf<string | undefined>()
    if (!affirm(x, { isPresent: true })) expectTypeOf(x).toEqualTypeOf<null | undefined>()
    if (!affirm(x, { isNullish: true })) expectTypeOf(x).toEqualTypeOf<string>()
  })

  test('type tags, guards and isArray', () => {
    const x = value<string | number>()
    if (!affirm(x, { isType: 'string' })) expectTypeOf(x).toEqualTypeOf<number>()
    const u = value<User | string>()
    if (!affirm(u, { isType: isUser })) expectTypeOf(u).toEqualTypeOf<string>()
    const a = value<string | string[]>()
    if (!affirm(a, { isArray: true })) expectTypeOf(a).toEqualTypeOf<string>()
  })

  test('literal membership', () => {
    const x = value<'a' | 'b' | 'c'>()
    if (!affirm(x, { isOneOf: ['a', 'b'] })) expectTypeOf(x).toEqualTypeOf<'c'>()
    if (!affirm(x, { is: 'a' })) expectTypeOf(x).toEqualTypeOf<'b' | 'c'>()
  })

  test('exact keys combine', () => {
    const x = value<string | number | null>()
    if (!affirm(x, { isPresent: true, isType: 'string' })) expectTypeOf(x).toEqualTypeOf<number | null>()
  })

  test('a key set to undefined is skipped, not refined', () => {
    const x = value<string | null>()
    if (!affirm(x, { isNull: true, isTruthy: undefined })) expectTypeOf(x).toEqualTypeOf<string>()
  })
})

describe('(d) branded values pass where the unbranded type is expected', () => {
  test('primitives and objects', () => {
    const takesString = (s: string) => s
    const takesDate = (d: Date) => d
    const takesNumber = (n: number) => n
    const x = value<unknown>()
    if (affirm(x, { isType: 'string', isTruthy: true })) takesString(x)
    if (affirm(x, { isInstanceOf: Date })) takesDate(x)
    if (affirm(x, { isFiniteNumber: true })) takesNumber(x + 1)
  })
})

describe('(e) Affirmed is nameable and reads as expected', () => {
  test('exported type matches the narrowing', () => {
    expectTypeOf<Affirmed<unknown, { isType: 'string' }>>().toEqualTypeOf<string>()
    expectTypeOf<Affirmed<string | null, { isPresent: true }>>().toEqualTypeOf<string>()
    expectTypeOf<Affirmed<unknown, { isType: 'string'; isTruthy: true }>>().toEqualTypeOf<string & Refined>()
  })
})

describe('call signature', () => {
  test('explain returns a report and does not narrow', () => {
    const x = value<string | null>()
    expectTypeOf(affirm.explain(x, { isNull: true })).toEqualTypeOf<AffirmReport>()
    expectTypeOf(x).toEqualTypeOf<string | null>()
  })

  test('unknown keys are compile errors, even next to valid ones', () => {
    const x = value<unknown>()
    // @ts-expect-error unknown key on its own
    affirm(x, { isnul: true })
    // @ts-expect-error unknown key next to a valid one (generic inference skips excess-property checks)
    affirm(x, { isNull: true, isTypo: 1 })
  })

  test('wrong param types are compile errors', () => {
    const x = value<unknown>()
    // @ts-expect-error boolean key
    affirm(x, { isNull: 'yes' })
    // @ts-expect-error class passed to isType
    affirm(x, { isType: Date })
  })

  test('a params variable typed AffirmParams is accepted', () => {
    const x = value<string | null>()
    const params = value<AffirmParams>()
    if (!affirm(x, params)) expectTypeOf(x).toEqualTypeOf<string | null>()
  })
})

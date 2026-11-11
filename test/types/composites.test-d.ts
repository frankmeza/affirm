// Narrowing for composite keys (M4): shape, everyItem, someItem, not, anyOf, satisfies.
import { describe, expectTypeOf, test } from 'vitest'
import { affirm, type AffirmParams } from '../../src'
import type { Affirmed } from '../../src/types/affirmed'
import type { Refined } from '../../src/types/narrowing'

declare function value<T>(): T

describe('shape', () => {
  test('design §1 example', () => {
    const order = value<unknown>()
    if (affirm(order, { hasKey: 'total', shape: { total: { isType: 'number', isPositive: true } } })) {
      expectTypeOf(order.total).toEqualTypeOf<number>()
    }
  })

  test('fields narrow independently; unknown input gives a fresh object type', () => {
    expectTypeOf<
      Affirmed<unknown, { shape: { id: { isType: 'string' }; tag: { isOneOf: readonly ['a', 'b'] } } }>
    >().toEqualTypeOf<{ id: string; tag: 'a' | 'b' } & Refined>()
  })

  test('a matching input type is kept', () => {
    interface User {
      id: string
      name: string
    }
    const x = value<User | null>()
    if (affirm(x, { shape: { id: { isType: 'string' } } })) expectTypeOf(x).toEqualTypeOf<User & Refined>()
    else expectTypeOf(x).toEqualTypeOf<User | null>()
  })

  test('nested shapes', () => {
    const x = value<unknown>()
    if (affirm(x, { shape: { user: { shape: { zip: { isType: 'string' } } } } })) {
      expectTypeOf(x.user.zip).toEqualTypeOf<string>()
    }
  })

  test('nullable fields', () => {
    const x = value<unknown>()
    if (affirm(x, { shape: { note: { anyOf: [{ isNull: true }, { isType: 'string' }] } } })) {
      expectTypeOf(x.note).toEqualTypeOf<string | null>()
    }
  })
})

describe('everyItem / someItem', () => {
  test('everyItem narrows the element type', () => {
    const x = value<unknown>()
    if (affirm(x, { everyItem: { isType: 'string' } })) expectTypeOf(x).toEqualTypeOf<readonly string[] & Refined>()
  })

  test('everyItem keeps a matching array type', () => {
    const x = value<string[] | null>()
    if (affirm(x, { everyItem: { isType: 'string' } })) expectTypeOf(x).toEqualTypeOf<string[] & Refined>()
    else expectTypeOf(x).toEqualTypeOf<string[] | null>()
  })

  test('everyItem + shape', () => {
    const x = value<unknown>()
    if (affirm(x, { everyItem: { shape: { id: { isType: 'string' } } } })) {
      expectTypeOf(x[0]!.id).toEqualTypeOf<string>()
    }
  })

  test('someItem narrows to an array only', () => {
    const x = value<unknown>()
    if (affirm(x, { someItem: { isType: 'string' } })) expectTypeOf(x).toEqualTypeOf<readonly unknown[] & Refined>()
  })
})

describe('anyOf', () => {
  test('exact branches: union, and the else branch excludes it', () => {
    const x = value<string | number | null | boolean>()
    if (affirm(x, { anyOf: [{ isNull: true }, { isType: 'string' }] })) expectTypeOf(x).toEqualTypeOf<string | null>()
    else expectTypeOf(x).toEqualTypeOf<number | boolean>()
  })

  test('one refined branch makes it refined', () => {
    const x = value<string | number | undefined>()
    if (affirm(x, { anyOf: [{ isType: 'number' }, { isType: 'string', hasMinLength: 1 }] })) {
      expectTypeOf(x).toEqualTypeOf<(string | number) & Refined>()
    } else {
      expectTypeOf(x).toEqualTypeOf<string | number | undefined>()
    }
  })
})

describe('not / satisfies', () => {
  test('not never narrows', () => {
    const x = value<string | number>()
    if (affirm(x, { not: { isType: 'string' } })) expectTypeOf(x).toEqualTypeOf<(string | number) & Refined>()
    else expectTypeOf(x).toEqualTypeOf<string | number>()
  })

  test('satisfies with a guard narrows (refined); a plain predicate does not', () => {
    const isEven = (v: unknown): v is number => typeof v === 'number' && v % 2 === 0
    const x = value<number | string>()
    if (affirm(x, { satisfies: isEven })) expectTypeOf(x).toEqualTypeOf<number & Refined>()
    else expectTypeOf(x).toEqualTypeOf<number | string>()
    if (affirm(x, { satisfies: (v) => v !== '' })) expectTypeOf(x).toEqualTypeOf<(number | string) & Refined>()
  })
})

describe('compile-time checks inside composites', () => {
  test('unknown keys in nested params are errors', () => {
    const x = value<unknown>()
    // @ts-expect-error unknown key in a shape field
    affirm(x, { shape: { total: { isNull: true, isTypo: 1 } } })
    // @ts-expect-error unknown key in everyItem
    affirm(x, { everyItem: { hasKey: 'id', isPresnt: true } })
    // @ts-expect-error unknown key in an anyOf branch
    affirm(x, { anyOf: [{ isNull: true }, { isType: 'string', minLen: 2 }] })
    // @ts-expect-error unknown key in not
    affirm(x, { not: { isNull: true, isNul: true } })
  })

  test('wide params still type-check without infinite recursion', () => {
    const x = value<unknown>()
    const p = value<AffirmParams>()
    affirm(x, { shape: { a: p }, everyItem: p, anyOf: [p, p], not: p })
  })
})

// `null & Refined` reduces to `never`, so a refined result containing null/undefined can't be branded.
// Those calls must fall back to a plain boolean instead of lying in either branch (design §6.3).
describe('soundness: refined results that can be null or undefined do not narrow', () => {
  test('isFalsy on a nullable string', () => {
    const x = value<string | null>()
    if (affirm(x, { isFalsy: true })) expectTypeOf(x).toEqualTypeOf<string | null>()
    else expectTypeOf(x).toEqualTypeOf<string | null>()
  })

  test('not on a nullable value', () => {
    const x = value<string | undefined>()
    if (affirm(x, { not: { isType: 'string' } })) expectTypeOf(x).toEqualTypeOf<string | undefined>()
  })

  test('a refined anyOf with a null branch', () => {
    const x = value<unknown>()
    if (affirm(x, { anyOf: [{ isNull: true }, { isType: 'string', hasMinLength: 1 }] })) {
      expectTypeOf(x).toEqualTypeOf<unknown>()
    }
  })

  test('affirm.assert also stops narrowing', () => {
    const x = value<string | null>()
    affirm.assert(x, { isFalsy: true })
    expectTypeOf(x).toEqualTypeOf<string | null>()
  })

  test('narrowing still happens when the refined result excludes null', () => {
    const x = value<string | null>()
    if (affirm(x, { isTruthy: true })) expectTypeOf(x).toEqualTypeOf<string & Refined>()
    if (affirm(x, { hasMinLength: 1 })) expectTypeOf(x).toEqualTypeOf<string & Refined>()
  })

  test('exact results may contain null (no brand needed)', () => {
    const x = value<string | number | null>()
    if (affirm(x, { anyOf: [{ isNull: true }, { isType: 'string' }] })) expectTypeOf(x).toEqualTypeOf<string | null>()
    else expectTypeOf(x).toEqualTypeOf<number>()
  })
})

// Narrowing for the M3 groups: size, numbers, strings, objects, arrays. All of their keys are refined,
// so every `else` branch must keep the full input type.
import { describe, expectTypeOf, test } from 'vitest'
import { affirm } from '../../src'
import type { Affirmed } from '../../src/types/affirmed'
import type { Refined } from '../../src/types/narrowing'

declare function value<T>(): T

describe('size', () => {
  test('has*Length narrows to the measurable members of the input', () => {
    const x = value<string | null>()
    if (affirm(x, { hasMinLength: 3 })) expectTypeOf(x).toEqualTypeOf<string & Refined>()
    else expectTypeOf(x).toEqualTypeOf<string | null>()

    const y = value<string[] | number>()
    if (affirm(y, { hasLength: 2 })) expectTypeOf(y).toEqualTypeOf<string[] & Refined>()
  })

  test('unknown input narrows to the measurable union', () => {
    expectTypeOf<Affirmed<unknown, { hasMaxLength: 1 }>>().toEqualTypeOf<
      (string | readonly unknown[] | ReadonlyMap<unknown, unknown> | ReadonlySet<unknown>) & Refined
    >()
  })

  test('isBlank narrows to string in both polarities (D7); isEmpty does not narrow', () => {
    const x = value<string | null>()
    if (affirm(x, { isBlank: false })) expectTypeOf(x).toEqualTypeOf<string & Refined>()
    if (affirm(x, { isEmpty: true })) expectTypeOf(x).toEqualTypeOf<(string | null) & Refined>()
  })
})

describe('numbers', () => {
  test('narrow to number, else keeps everything', () => {
    const x = value<number | string>()
    if (affirm(x, { isGreaterThan: 0 })) expectTypeOf(x).toEqualTypeOf<number & Refined>()
    else expectTypeOf(x).toEqualTypeOf<number | string>()
    if (affirm(x, { isPositive: false })) expectTypeOf(x).toEqualTypeOf<number & Refined>()
  })

  test('isBetween takes a [min, max] pair', () => {
    const x = value<unknown>()
    if (affirm(x, { isBetween: [1, 10] })) expectTypeOf(x).toEqualTypeOf<number & Refined>()
    // @ts-expect-error three elements
    affirm(x, { isBetween: [1, 2, 3] })
  })

  test('literal number unions keep their members', () => {
    const x = value<1 | 2 | 3 | 'none'>()
    if (affirm(x, { isAtLeast: 2 })) expectTypeOf(x).toEqualTypeOf<(1 | 2 | 3) & Refined>()
  })
})

describe('strings', () => {
  test('narrow to string, else keeps everything', () => {
    const x = value<string | null>()
    if (affirm(x, { startsWith: 'a', matches: /b/ })) expectTypeOf(x).toEqualTypeOf<string & Refined>()
    else expectTypeOf(x).toEqualTypeOf<string | null>()
  })

  test('matches requires a RegExp at compile time', () => {
    // @ts-expect-error string instead of RegExp
    affirm(value<unknown>(), { matches: 'abc' })
  })
})

describe('objects', () => {
  test('hasKey with a literal key', () => {
    const x = value<unknown>()
    if (affirm(x, { hasKey: 'total' })) {
      expectTypeOf(x).toEqualTypeOf<Record<'total', unknown> & Refined>()
      expectTypeOf(x.total).toEqualTypeOf<unknown>()
    }
  })

  test('hasKey keeps a matching input type as is', () => {
    interface Order {
      id: string
      total?: number
    }
    const x = value<Order | null>()
    if (affirm(x, { hasKey: 'id' })) expectTypeOf(x).toEqualTypeOf<Order & Refined>()
    else expectTypeOf(x).toEqualTypeOf<Order | null>()
  })

  test('hasKey on an optional property makes it required but keeps undefined', () => {
    const x = value<{ total?: number } | null>()
    if (affirm(x, { hasKey: 'total' })) expectTypeOf(x.total).toEqualTypeOf<number | undefined>()
  })

  test('hasKey with a wide key narrows to object only', () => {
    const key = value<string>()
    const x = value<unknown>()
    if (affirm(x, { hasKey: key })) expectTypeOf(x).toEqualTypeOf<object & Refined>()
  })

  test('hasKeys with literal keys', () => {
    const x = value<unknown>()
    if (affirm(x, { hasKeys: ['a', 'b'] })) expectTypeOf(x).toEqualTypeOf<Record<'a' | 'b', unknown> & Refined>()
  })

  test('hasPath builds the nested type', () => {
    const x = value<unknown>()
    if (affirm(x, { hasPath: 'user.address.zip' })) {
      expectTypeOf(x.user.address.zip).toEqualTypeOf<unknown>()
    }
    expectTypeOf<Affirmed<unknown, { hasPath: 'items.0.id' }>>().toEqualTypeOf<
      { items: { 0: { id: unknown } } } & Refined
    >()
  })

  test('hasAnyKey / hasOnlyKeys narrow to object', () => {
    const x = value<string | object>()
    if (affirm(x, { hasAnyKey: ['a'] })) expectTypeOf(x).toEqualTypeOf<object & Refined>()
  })
})

describe('arrays', () => {
  test('contains* narrow to the array members of the input', () => {
    const x = value<string[] | string>()
    if (affirm(x, { contains: 'a' })) expectTypeOf(x).toEqualTypeOf<string[] & Refined>()
    else expectTypeOf(x).toEqualTypeOf<string[] | string>()
  })

  test('unknown input narrows to readonly unknown[]', () => {
    const x = value<unknown>()
    if (affirm(x, { containsAny: [1, 2] })) expectTypeOf(x).toEqualTypeOf<readonly unknown[] & Refined>()
  })
})

describe('combining M1 and M3 keys', () => {
  test('design §1 example narrows to an object with total', () => {
    const order = value<{ total: number } | null>()
    if (affirm(order, { isPresent: true, hasKey: 'total' })) {
      expectTypeOf(order.total).toEqualTypeOf<number>()
    }
  })

  test('one refined key makes an exact combination refined', () => {
    const x = value<string | number | null>()
    if (!affirm(x, { isType: 'string', hasMinLength: 3 })) expectTypeOf(x).toEqualTypeOf<string | number | null>()
  })
})

import { describe, expect, test, vi } from 'vitest'
import { affirm } from '../../src'

describe('shape', () => {
  test('each listed field passes its params; unlisted fields ignored', () => {
    const order = { total: 10, id: 'o1', extra: true }
    expect(affirm(order, { shape: { total: { isType: 'number', isPositive: true }, id: { startsWith: 'o' } } })).toBe(
      true,
    )
    expect(affirm({ total: -1 }, { shape: { total: { isPositive: true } } })).toBe(false)
  })

  test('missing and inherited fields are checked as undefined (D2)', () => {
    expect(affirm({}, { shape: { note: { isUndefined: true } } })).toBe(true)
    expect(affirm({}, { shape: { toString: { isUndefined: true } } })).toBe(true)
    expect(affirm({}, { shape: { note: { isPresent: true } } })).toBe(false)
  })

  test('wrong kind: one failure, not one per field (rule 7)', () => {
    const { failures } = affirm.explain('nope', { shape: { a: { isPresent: true }, b: { isPresent: true } } })
    expect(failures).toHaveLength(1)
    expect(failures[0]).toMatchObject({ key: 'shape', path: '', expected: 'an object or array' })
  })

  test('nested paths in reports', () => {
    const user = { address: { zip: '12' } }
    const { failures } = affirm.explain(user, { shape: { address: { shape: { zip: { hasMinLength: 5 } } } } })
    expect(failures).toEqual([
      {
        key: 'hasMinLength',
        path: 'address.zip',
        expected: 'length >= 5',
        received: 'string(len 2)',
        reason: 'address.zip: expected length >= 5, received string(len 2)',
      },
    ])
  })

  test('affirm() stops at the first failing field; explain() reports all', () => {
    const params = { shape: { a: { isPresent: true }, b: { isPresent: true } } }
    expect(affirm.explain({}, params).failures.map((f) => f.path)).toEqual(['a', 'b'])
  })

  test('invalid shapes throw, with the nested path', () => {
    expect(() => affirm({}, { shape: {} })).toThrow(/at least one field/)
    expect(() => affirm({}, { shape: { a: {} } })).toThrow(/params at `a` are empty/)
    expect(() => affirm({}, { shape: { a: { isnul: true } as never } })).toThrow(
      /unknown check `isnul` at `a`\. Did you mean `isNull`\?/,
    )
    expect(() => affirm({}, { shape: [] as never })).toThrow(TypeError)
  })
})

describe('everyItem / someItem', () => {
  test('everyItem: all items pass; vacuously true on []', () => {
    expect(affirm([1, 2], { everyItem: { isPositive: true } })).toBe(true)
    expect(affirm([1, -2], { everyItem: { isPositive: true } })).toBe(false)
    expect(affirm([], { everyItem: { isPositive: true } })).toBe(true)
  })

  test('someItem: at least one passes; false on []', () => {
    expect(affirm([-1, 2], { someItem: { isPositive: true } })).toBe(true)
    expect(affirm([-1], { someItem: { isPositive: true } })).toBe(false)
    expect(affirm([], { someItem: { isPositive: true } })).toBe(false)
  })

  test('design §8 path example: items[2].id', () => {
    const order = { items: [{ id: 'abc' }, { id: 'def' }, { id: 'gh' }] }
    const { failures } = affirm.explain(order, { shape: { items: { everyItem: { shape: { id: { hasMinLength: 3 } } } } } })
    expect(failures.map((f) => f.reason)).toEqual(['items[2].id: expected length >= 3, received string(len 2)'])
  })

  test('explain() collects every failing item; affirm() stops at the first', () => {
    const guard = vi.fn((v: unknown) => typeof v === 'number')
    expect(affirm(['a', 'b', 'c'], { everyItem: { satisfies: guard } })).toBe(false)
    expect(guard).toHaveBeenCalledOnce()
    expect(affirm.explain(['a', 'b'], { everyItem: { isType: 'number' } }).failures.map((f) => f.path)).toEqual([
      '[0]',
      '[1]',
    ])
  })

  test('someItem reports one failure, not one per item', () => {
    const { failures } = affirm.explain([1, 2, 3], { someItem: { isNegative: true } })
    expect(failures).toHaveLength(1)
    expect(failures[0]?.expected).toBe('at least one item passing { isNegative: true }')
  })

  test('non-arrays fail once', () => {
    expect(affirm.explain({ 0: 1, length: 1 }, { everyItem: { isPositive: true } }).failures).toHaveLength(1)
  })

  test('item params are validated even for empty arrays', () => {
    expect(() => affirm([], { everyItem: { isPositiv: true } as never })).toThrow(/at `\[\*\]`/)
  })
})

describe('not', () => {
  test('passes when the nested params fail', () => {
    expect(affirm('guest', { not: { isOneOf: ['admin', 'root'] } })).toBe(true)
    expect(affirm('admin', { not: { isOneOf: ['admin', 'root'] } })).toBe(false)
  })

  test('nested params combine with AND, so not(A and B) = not A or not B', () => {
    expect(affirm(5, { not: { isPositive: true, isLessThan: 3 } })).toBe(true)
    expect(affirm(2, { not: { isPositive: true, isLessThan: 3 } })).toBe(false)
  })

  test('failure wording', () => {
    expect(affirm.explain(null, { not: { isNull: true } }).failures[0]?.expected).toBe('not { isNull: true }')
  })
})

describe('anyOf', () => {
  test('passes when any branch passes (the only OR)', () => {
    const nullOrEmpty = { anyOf: [{ isNullish: true }, { isEmpty: true }] } as const
    expect(affirm(null, nullOrEmpty)).toBe(true)
    expect(affirm('', nullOrEmpty)).toBe(true)
    expect(affirm('x', nullOrEmpty)).toBe(false)
  })

  test('failure lists every branch in `branches`', () => {
    const { failures } = affirm.explain('x', { anyOf: [{ isNull: true }, { isType: 'number', isPositive: true }] })
    expect(failures).toHaveLength(1)
    expect(failures[0]).toMatchObject({ key: 'anyOf', expected: 'any of 2 branches to pass' })
    expect(failures[0]?.branches?.map((b) => b.map((f) => f.key))).toEqual([['isNull'], ['isType', 'isPositive']])
  })

  test('branch paths stay relative to the value under check', () => {
    const { failures } = affirm.explain(
      { a: 'x' },
      { shape: { a: { anyOf: [{ isNull: true }, { isType: 'number' }] } } },
    )
    expect(failures[0]?.path).toBe('a')
    expect(failures[0]?.branches?.[0]?.[0]?.reason).toBe('a: expected null, received string(len 1)')
  })

  test('empty or non-array anyOf throws', () => {
    expect(() => affirm(1, { anyOf: [] })).toThrow(/non-empty array/)
    expect(() => affirm(1, { anyOf: { isNull: true } as never })).toThrow(TypeError)
    expect(() => affirm(1, { anyOf: [{ isNul: true } as never] })).toThrow(/Did you mean `isNull`/)
  })
})

describe('satisfies', () => {
  test('predicate decides; runs last', () => {
    const calls: string[] = []
    const even = (v: unknown) => {
      calls.push('satisfies')
      return typeof v === 'number' && v % 2 === 0
    }
    expect(affirm(4, { satisfies: even, isPositive: true })).toBe(true)
    expect(affirm(-4, { satisfies: even, isPositive: true })).toBe(false)
    expect(calls).toEqual(['satisfies']) // the second call short-circuited on isPositive
  })

  test('cross-field rules', () => {
    const range = { min: 1, max: 5 }
    expect(affirm(range, { satisfies: (r) => (r as typeof range).min <= (r as typeof range).max })).toBe(true)
  })

  test('only exactly true passes', () => {
    expect(affirm(1, { satisfies: (() => 1) as never })).toBe(false)
  })

  test('errors thrown by the predicate propagate', () => {
    expect(() =>
      affirm(1, {
        satisfies: () => {
          throw new Error('boom')
        },
      }),
    ).toThrow('boom')
  })

  test('non-function throws', () => {
    expect(() => affirm(1, { satisfies: true as never })).toThrow(TypeError)
  })
})

describe('report snapshot (design §8)', () => {
  test('a realistic order', () => {
    const order = {
      id: 'ord_1',
      total: -5,
      customer: { email: 'not-an-email' },
      items: [{ sku: 'A1', qty: 1 }, { sku: '', qty: 0 }],
    }
    const report = affirm.explain(order, {
      isPlainObject: true,
      hasKeys: ['id', 'total', 'items'],
      shape: {
        total: { isType: 'number', isPositive: true },
        customer: { shape: { email: { matches: /^[^@]+@[^@]+$/ } } },
        items: {
          isNotEmpty: true,
          everyItem: { shape: { sku: { isBlank: false }, qty: { isInteger: true, isAtLeast: 1 } } },
        },
      },
    })
    expect(report).toMatchInlineSnapshot(`
      {
        "failures": [
          {
            "expected": "> 0",
            "key": "isPositive",
            "path": "total",
            "reason": "total: expected > 0, received number",
            "received": "number",
          },
          {
            "expected": "a string matching /^[^@]+@[^@]+$/",
            "key": "matches",
            "path": "customer.email",
            "reason": "customer.email: expected a string matching /^[^@]+@[^@]+$/, received string(len 12)",
            "received": "string(len 12)",
          },
          {
            "expected": "a non-blank string",
            "key": "isBlank",
            "path": "items[1].sku",
            "reason": "items[1].sku: expected a non-blank string, received string(len 0)",
            "received": "string(len 0)",
          },
          {
            "expected": ">= 1",
            "key": "isAtLeast",
            "path": "items[1].qty",
            "reason": "items[1].qty: expected >= 1, received number",
            "received": "number",
          },
        ],
        "ok": false,
      }
    `)
    expect(JSON.stringify(report)).not.toContain('not-an-email')
  })

  test('AffirmError message from nested failures', () => {
    expect(() =>
      affirm.assert({ a: 1, b: 2, c: 3, d: 4 }, {
        shape: { a: { isNull: true }, b: { isNull: true }, c: { isNull: true }, d: { isNull: true } },
      }),
    ).toThrow(
      expect.objectContaining({
        name: 'AffirmError',
        message: 'affirm.assert failed: a: expected null, received number; b: expected null, received number; c: expected null, received number (+1 more)',
      }),
    )
  })
})

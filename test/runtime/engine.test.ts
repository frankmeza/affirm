import { describe, expect, test, vi } from 'vitest'
import { affirm, AffirmError } from '../../src'
import type { CheckDef } from '../../src/core/check-def'
import { checks, defineRegistry, KEY_ORDER } from '../../src/core/registry'

describe('registry', () => {
  test('contains every key in the design (§5)', () => {
    expect(Object.keys(checks).sort()).toEqual(
      [
        // equality
        'is', 'isNot', 'isOneOf', 'isNotOneOf', 'isDeepEqual',
        // nullish
        'isNull', 'isUndefined', 'isNullish', 'isDefined', 'isPresent', 'isTruthy', 'isFalsy',
        // runtime type
        'isType', 'isArray', 'isPlainObject', 'isFunction', 'isInstanceOf',
        'isValidDate', 'isInteger', 'isFiniteNumber', 'isNaN',
        // size
        'isEmpty', 'isNotEmpty', 'isBlank', 'hasLength', 'hasMinLength', 'hasMaxLength',
        // numbers
        'isGreaterThan', 'isAtLeast', 'isLessThan', 'isAtMost', 'isBetween', 'isPositive', 'isNegative', 'isMultipleOf',
        // strings
        'startsWith', 'endsWith', 'includes', 'matches',
        // objects
        'hasKey', 'hasKeys', 'hasAnyKey', 'hasOnlyKeys', 'hasPath',
        // arrays
        'contains', 'containsAll', 'containsAny', 'everyItem', 'someItem',
        // objects (M4)
        'shape',
        // composition
        'not', 'anyOf', 'satisfies',
      ].sort(),
    )
  })

  test('duplicate keys across groups throw', () => {
    const def = checks.isNull as CheckDef<any>
    expect(() => defineRegistry({ a: def }, { a: def })).toThrow(/duplicate check key `a`/)
  })

  test('KEY_ORDER is sorted by phase', () => {
    const phases = KEY_ORDER.map((key) => checks[key].phase)
    expect(phases).toEqual([...phases].sort((a, b) => a - b))
    expect(KEY_ORDER.at(-1)).toBe('satisfies') // the only Predicate key: always last
  })
})

describe('rule 2: keys combine with AND', () => {
  test('all keys must pass', () => {
    expect(affirm('a', { isType: 'string', isOneOf: ['a', 'b'] })).toBe(true)
    expect(affirm('c', { isType: 'string', isOneOf: ['a', 'b'] })).toBe(false)
  })
})

describe('rule 3: omitted or undefined key = skip', () => {
  test('undefined param is skipped, not validated', () => {
    expect(affirm(null, { isNull: true, isType: undefined })).toBe(true)
  })

  test('params whose keys are all undefined pass (conditional building)', () => {
    const strict = false
    expect(affirm(42, { isNull: strict ? true : undefined })).toBe(true)
  })
})

describe('rule 6: programmer errors throw TypeError from all entry points', () => {
  const entryPoints = {
    affirm: (params: unknown) => affirm(1, params as never),
    explain: (params: unknown) => affirm.explain(1, params as never),
    assert: (params: unknown) => affirm.assert(1, params as never),
  }

  describe.each(Object.entries(entryPoints))('%s', (_, run) => {
    test('empty params', () => {
      expect(() => run({})).toThrow(new TypeError('affirm: params are empty; `{}` would always pass'))
    })

    test('non-object params', () => {
      expect(() => run(null)).toThrow(TypeError)
      expect(() => run([])).toThrow(TypeError)
      expect(() => run('isNull')).toThrow(TypeError)
    })

    test('unknown key with suggestion', () => {
      expect(() => run({ isnul: true })).toThrow(new TypeError('affirm: unknown check `isnul`. Did you mean `isNull`?'))
      expect(() => run({ isTyp: 'string' })).toThrow(/Did you mean `isType`\?/)
    })

    test('unknown key with no close match has no suggestion', () => {
      expect(() => run({ frobnicate: true })).toThrow(new TypeError('affirm: unknown check `frobnicate`.'))
    })

    test('wrong param type', () => {
      expect(() => run({ isNull: 1 })).toThrow(TypeError)
    })
  })

  test('validation runs before evaluation, so a typo is not hidden by a short-circuit', () => {
    // isNull fails first on 1, but the bad isTypo key must still throw
    expect(() => affirm(1, { isNull: true, isTypo: true } as never)).toThrow(/unknown check `isTypo`/)
  })

  test('data failures never throw', () => {
    expect(affirm(Symbol('x'), { isOneOf: [1], isDeepEqual: {}, isValidDate: true })).toBe(false)
  })
})

describe('rule 7: canonical evaluation order', () => {
  test('explain collects failures in canonical order regardless of param key order', () => {
    const { failures } = affirm.explain('x', { isDeepEqual: { a: 1 }, isOneOf: [1], isNull: true })
    expect(failures.map((f) => f.key)).toEqual(['isNull', 'isOneOf', 'isDeepEqual'])
  })

  test('affirm() short-circuits on the first failure', () => {
    const spy = vi.fn()
    const guard = (v: unknown): v is string => (spy(), typeof v === 'string')
    expect(affirm('x', { isType: guard, isNull: true })).toBe(false)
    expect(spy).not.toHaveBeenCalled() // isNull (nullish group) runs before isType
  })

  test('explain() evaluates every key', () => {
    const spy = vi.fn()
    const guard = (v: unknown): v is string => (spy(), typeof v === 'string')
    const report = affirm.explain('x', { isType: guard, isNull: true })
    expect(spy).toHaveBeenCalledOnce()
    expect(report.failures.map((f) => f.key)).toEqual(['isNull'])
  })
})

describe('affirm.assert / AffirmError (design §9)', () => {
  test('passes silently', () => {
    expect(() => affirm.assert('x', { isType: 'string' })).not.toThrow()
  })

  test('throws AffirmError carrying the report', () => {
    try {
      affirm.assert(null, { isPresent: true })
      expect.unreachable()
    } catch (error) {
      expect(error).toBeInstanceOf(AffirmError)
      const e = error as AffirmError
      expect(e.name).toBe('AffirmError')
      expect(e.report.ok).toBe(false)
      expect(e.message).toBe('affirm.assert failed: expected present (not null or undefined), received null')
    }
  })

  test('caller message wins', () => {
    expect(() => affirm.assert(null, { isPresent: true }, 'user required')).toThrow(expect.objectContaining({ name: 'AffirmError', message: 'user required' }))
  })

  test('default message lists at most 3 reasons, then (+N more)', () => {
    const params = { isNull: true, isUndefined: true, isTruthy: true, isType: 'string', isArray: true } as const
    // @ts-expect-error contradictory on purpose: we want five failures
    expect(() => affirm.assert(0, params)).toThrow(/^affirm\.assert failed: .+; .+; [^;]+ \(\+2 more\)$/)
  })
})

describe('report never contains raw values (D5)', () => {
  test('received is a type description', () => {
    const secret = 'hunter2-ssn-123-45-6789'
    const { failures } = affirm.explain(
      { password: secret },
      { isNull: true, isArray: true, isOneOf: [1], isDeepEqual: { a: 1 } },
    )
    for (const failure of failures) {
      expect(failure.received).toBe('object{1 key}')
      expect(JSON.stringify(failure)).not.toContain(secret)
    }
  })
})

describe('rule 7 across phases (M3)', () => {
  test('Kind → Measure → Structural, regardless of param key order', () => {
    // @ts-expect-error contradictory on purpose (isType string + number key): we want one failure per phase
    const { failures } = affirm.explain(42, {
      isDeepEqual: [1],
      hasMinLength: 3,
      contains: 1,
      isGreaterThan: 100,
      isType: 'string',
    })
    expect(failures.map((f) => f.key)).toEqual(['isType', 'hasMinLength', 'isGreaterThan', 'contains', 'isDeepEqual'])
  })

  test('a failing type check short-circuits before Measure checks', () => {
    const guard = (v: unknown): v is string => typeof v === 'string'
    expect(affirm(42, { hasMinLength: 3, isType: guard })).toBe(false)
    expect(affirm.explain(42, { hasMinLength: 3, isType: guard }).failures).toHaveLength(2)
  })
})

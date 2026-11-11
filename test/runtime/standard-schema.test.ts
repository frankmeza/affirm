// isType with a Standard Schema (design §10). Hand-rolled schemas: no Zod/Valibot dependency.
import { describe, expect, test, vi } from 'vitest'
import { affirm } from '../../src'
import type { StandardSchemaV1 } from '../../src/core/util/standard-schema'

type Issue = StandardSchemaV1.Issue

/** A minimal sync schema built from a check function that returns issues. */
function schema<T>(check: (value: unknown) => Issue[], vendor = 'test'): StandardSchemaV1<T> {
  return {
    '~standard': {
      version: 1,
      vendor,
      validate: (value) => {
        const issues = check(value)
        return issues.length === 0 ? { value: value as T } : { issues }
      },
    },
  }
}

const stringSchema = schema<string>((v) => (typeof v === 'string' ? [] : [{ message: 'Expected string' }]))

/** `{ name: string; tags: string[] }`, reporting nested issue paths the way Zod does. */
const userSchema = schema<{ name: string; tags: string[] }>((v) => {
  const issues: Issue[] = []
  const user = v as { name?: unknown; tags?: unknown }
  if (typeof user?.name !== 'string') issues.push({ message: 'bad name', path: ['name'] })
  if (Array.isArray(user?.tags)) {
    user.tags.forEach((tag, i) => {
      if (typeof tag !== 'string') issues.push({ message: 'bad tag', path: ['tags', { key: i }] })
    })
  } else {
    issues.push({ message: 'bad tags', path: ['tags'] })
  }
  return issues
}, 'zod')

describe('isType: Standard Schema', () => {
  test('pass / fail', () => {
    expect(affirm('a', { isType: stringSchema })).toBe(true)
    expect(affirm(1, { isType: stringSchema })).toBe(false)
  })

  test('combines with other keys', () => {
    expect(affirm('abc', { isType: stringSchema, hasMinLength: 3 })).toBe(true)
    expect(affirm('ab', { isType: stringSchema, hasMinLength: 3 })).toBe(false)
  })

  test('issues become failures with key isType and the issue path appended', () => {
    const report = affirm.explain({ name: 1, tags: ['a', 2] }, { isType: userSchema })
    expect(report.failures).toEqual([
      {
        key: 'isType',
        path: 'name',
        expected: 'a value accepted by the zod schema',
        received: 'number',
        reason: 'name: expected a value accepted by the zod schema, received number',
      },
      {
        key: 'isType',
        path: 'tags[1]',
        expected: 'a value accepted by the zod schema',
        received: 'number',
        reason: 'tags[1]: expected a value accepted by the zod schema, received number',
      },
    ])
  })

  test('issue paths are appended to the current path (inside shape)', () => {
    const report = affirm.explain({ user: { name: 'x', tags: 'nope' } }, { shape: { user: { isType: userSchema } } })
    expect(report.failures.map((f) => f.path)).toEqual(['user.tags'])
  })

  test('issue messages are not copied into reports (D5)', () => {
    const leaky = schema(() => [{ message: 'Invalid enum value, received "alice@example.com"' }])
    const report = affirm.explain('alice@example.com', { isType: leaky })
    expect(JSON.stringify(report)).not.toContain('alice')
  })

  test('a failure result with an empty issues array still fails', () => {
    const odd: StandardSchemaV1 = { '~standard': { version: 1, vendor: 'odd', validate: () => ({ issues: [] }) } }
    expect(affirm.explain(1, { isType: odd }).failures).toHaveLength(1)
  })

  test('callable schemas (ArkType style) are treated as schemas, not guards', () => {
    const validate = vi.fn((v: unknown) => (typeof v === 'number' ? { value: v } : { issues: [{ message: 'no' }] }))
    const callable = Object.assign(() => true, { '~standard': { version: 1 as const, vendor: 'arktype', validate } })
    expect(affirm('x', { isType: callable })).toBe(false) // the function itself would return true
    expect(validate).toHaveBeenCalledOnce()
  })

  test('async schemas throw TypeError from every entry point (rule 6)', () => {
    const asyncSchema: StandardSchemaV1 = {
      '~standard': { version: 1, vendor: 'valibot', validate: async (value) => ({ value }) },
    }
    const message = /async schemas are not supported by affirm; validate them before calling affirm \(vendor: valibot\)/
    expect(() => affirm(1, { isType: asyncSchema })).toThrow(message)
    expect(() => affirm.explain(1, { isType: asyncSchema })).toThrow(TypeError)
    expect(() => affirm.assert(1, { isType: asyncSchema })).toThrow(TypeError)
  })

  test('objects that only look like schemas are rejected as params', () => {
    expect(() => affirm(1, { isType: { '~standard': { version: 2, validate: () => ({}) } } as never })).toThrow(
      TypeError,
    )
    expect(() => affirm(1, { isType: { '~standard': {} } as never })).toThrow(TypeError)
  })
})

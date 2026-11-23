// The ESLint plugin keeps a static copy of the params keys; it must match the real registry.
import { expect, test } from 'vitest'
import { CHECK_KEYS, GENERIC_KEYS } from '../../src/eslint/check-keys'
import { checks } from '../../src/core/registry'

test('CHECK_KEYS matches the registry', () => {
  expect([...CHECK_KEYS].sort()).toEqual(Object.keys(checks).sort())
})

test('GENERIC_KEYS are all real keys', () => {
  for (const key of GENERIC_KEYS) expect(CHECK_KEYS.has(key), key).toBe(true)
})

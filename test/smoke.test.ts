// M0 toolchain smoke test. Delete once real tests land in M1.
import { expect, test } from 'vitest'
import { VERSION } from '../src/index'

test('runtime tests run against src', () => {
  expect(VERSION).toBe('0.0.0')
})

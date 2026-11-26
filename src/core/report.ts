import { describe } from './describe.js'

/** One failed check. Never contains raw values from the checked data (design §8, D5). */
export interface AffirmFailure {
  /** The params key that failed, e.g. `'hasMinLength'`. */
  key: string
  /** `''` at the root; `'user.address.zip'`; `'items[2].id'`. */
  path: string
  /** What the check wanted, e.g. `'length >= 3'`, `'not null'`. */
  expected: string
  /** A type description of the value, e.g. `'string(len 2)'`. */
  received: string
  /** One human sentence combining path, expected and received. */
  reason: string
  /** For `anyOf`: the failures of each branch. */
  branches?: AffirmFailure[][]
}

export interface AffirmReport {
  ok: boolean
  failures: AffirmFailure[]
}

export function makeFailure(key: string, path: string, expected: string, value: unknown): AffirmFailure {
  const received = describe(value)
  const reason = `${path === '' ? '' : `${path}: `}expected ${expected}, received ${received}`
  return { key, path, expected, received, reason }
}

/** `joinPath('items', 2)` → `'items[2]'`; `joinPath('user', 'zip')` → `'user.zip'`. */
export function joinPath(base: string, segment: string | number): string {
  if (typeof segment === 'number') return `${base}[${segment}]`
  return base === '' ? segment : `${base}.${segment}`
}

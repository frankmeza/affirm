import type { AffirmParams } from '../types/params.js'
import { formatParam } from './describe.js'
import { checks, isCheckKey, KEY_ORDER } from './registry.js'
import { closest } from './util/levenshtein.js'

/**
 * Throws `TypeError` for programmer errors (design §4 rule 6, D4):
 * params that are not an object, empty params `{}`, unknown keys, and wrong param types.
 * Runs over all keys before any evaluation, so a typo can't hide behind a short-circuit.
 * `path` locates nested params (from `shape`, `everyItem`, …) in messages.
 */
export function validateParams(params: unknown, path = ''): asserts params is AffirmParams {
  const where = path === '' ? '' : ` at \`${path}\``
  if (typeof params !== 'object' || params === null || Array.isArray(params)) {
    throw new TypeError(`affirm: params${where} must be an object of checks, received ${formatParam(params)}`)
  }
  const keys = Object.keys(params)
  if (keys.length === 0) {
    throw new TypeError(`affirm: params${where} are empty; \`{}\` would always pass`)
  }
  for (const key of keys) {
    if (!isCheckKey(key)) {
      const suggestion = closest(key, KEY_ORDER)
      const hint = suggestion === undefined ? '' : ` Did you mean \`${suggestion}\`?`
      throw new TypeError(`affirm: unknown check \`${key}\`${where}.${hint}`)
    }
    const param: unknown = (params as Record<string, unknown>)[key]
    if (param === undefined) continue // rule 3: undefined = skip
    const problem = checks[key].validateParam(param, path, validateParams)
    if (problem !== undefined) {
      throw new TypeError(`affirm: invalid param for \`${key}\`${where}: expected ${problem}`)
    }
  }
}

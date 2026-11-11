import { arrayChecks } from '../checks/arrays'
import { equalityChecks } from '../checks/equality'
import { nullishChecks } from '../checks/nullish'
import { numberChecks } from '../checks/numbers'
import { objectChecks } from '../checks/objects'
import { runtimeTypeChecks } from '../checks/runtime-type'
import { sizeChecks } from '../checks/size'
import { stringChecks } from '../checks/strings'
import type { AffirmParams } from '../types/params'
import type { CheckDef, CheckGroup } from './check-def'

type AnyGroup = Readonly<Record<string, CheckDef<any>>>
type UnionToIntersection<U> = (U extends unknown ? (u: U) => void : never) extends (i: infer I) => void ? I : never

/**
 * Merges group objects into one registry. Throws at module load on a duplicate key,
 * which a plain spread would silently overwrite.
 */
export function defineRegistry<const G extends readonly AnyGroup[]>(...groups: G): UnionToIntersection<G[number]> {
  const merged: Record<string, CheckDef<any>> = {}
  for (const group of groups) {
    for (const key of Object.keys(group)) {
      if (Object.hasOwn(merged, key)) throw new Error(`affirm: duplicate check key \`${key}\` across groups`)
      merged[key] = group[key]!
    }
  }
  return merged as UnionToIntersection<G[number]>
}

/** Every check, keyed by params key. Group order here is the tie-breaker within a phase. */
export const checks: CheckGroup<AffirmParams> = defineRegistry(
  nullishChecks,
  runtimeTypeChecks,
  equalityChecks,
  sizeChecks,
  numberChecks,
  stringChecks,
  objectChecks,
  arrayChecks,
)

export type CheckKey = keyof AffirmParams

/** All keys, sorted by phase (stable, so registry order breaks ties). Design §4 rule 7. */
export const KEY_ORDER: readonly CheckKey[] = (Object.keys(checks) as CheckKey[])
  .map((key, index) => ({ key, index, phase: checks[key].phase }))
  .sort((a, b) => a.phase - b.phase || a.index - b.index)
  .map(({ key }) => key)

const RANK: ReadonlyMap<string, number> = new Map(KEY_ORDER.map((key, i) => [key, i]))

export function isCheckKey(key: string): key is CheckKey {
  return RANK.has(key)
}

/** Canonical rank of a key; only call with keys that passed `isCheckKey`. */
export function rankOf(key: CheckKey): number {
  return RANK.get(key)!
}

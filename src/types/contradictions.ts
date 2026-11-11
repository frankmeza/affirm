import type { AffirmParams } from './params'

/**
 * Compile-time check for unknown keys. Generic inference skips excess-property checks, so
 * `{ isNull: true, isTypo: 1 }` would otherwise type-check (it still throws at runtime).
 * Resolves to `{}` when P is fine. Otherwise each unknown key gets an error object, which the
 * editor shows as `… not assignable to type '{ __affirmError: "unknown check 'isTypo'" }'`.
 * (An error *object*, not a string: `1 & 'message'` would collapse to `never` and hide the text.)
 */
export type NoUnknownKeys<P> = {
  [K in Exclude<keyof P, keyof AffirmParams>]: { __affirmError: `unknown check '${K & string}'` }
}

/**
 * Design §6.4. Resolves to `unknown` when P is fine, or `{ __affirmError: '<message>' }`.
 * Placeholder until M5.
 */
export type NoContradictions<_P> = unknown

/** Everything the call signature intersects with P. */
export type ParamsCheck<P> = NoUnknownKeys<P> & NoContradictions<P>

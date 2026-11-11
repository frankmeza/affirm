import type { AffirmParams } from './params'

/**
 * Compile-time check for unknown keys. Generic inference skips excess-property checks, so
 * `{ isNull: true, isTypo: 1 }` would otherwise type-check (it still throws at runtime).
 * Resolves to `{}` when P is fine. Otherwise each unknown key gets an error object, which the
 * editor shows as `… not assignable to type '{ __affirmError: "unknown check 'isTypo'" }'`.
 * (An error *object*, not a string: `1 & 'message'` would collapse to `never` and hide the text.)
 */
export type NoUnknownKeys<P> = AffirmParams extends P
  ? unknown // wide params (a variable typed AffirmParams): nothing to check, and avoids infinite recursion
  : { [K in Exclude<keyof P, keyof AffirmParams>]: { __affirmError: `unknown check '${K & string}'` } } & NestedKeys<P>

/** Applies `NoUnknownKeys` inside composite keys: shape fields, everyItem, someItem, not, anyOf branches. */
type NestedKeys<P> = ('shape' extends keyof P
  ? P['shape'] extends object
    ? { shape: { [F in keyof P['shape']]: NoUnknownKeys<P['shape'][F]> } }
    : unknown
  : unknown) &
  ('everyItem' extends keyof P ? { everyItem: NoUnknownKeys<P['everyItem']> } : unknown) &
  ('someItem' extends keyof P ? { someItem: NoUnknownKeys<P['someItem']> } : unknown) &
  ('not' extends keyof P ? { not: NoUnknownKeys<P['not']> } : unknown) &
  ('anyOf' extends keyof P
    ? P['anyOf'] extends readonly unknown[]
      ? { anyOf: Branches<P['anyOf']> }
      : unknown
    : unknown)

/**
 * Design §6.4. Resolves to `unknown` when P is fine, or `{ __affirmError: '<message>' }`.
 * Placeholder until M5.
 */
export type NoContradictions<_P> = unknown

/** Everything the call signature intersects with P. */
export type ParamsCheck<P> = NoUnknownKeys<P> & NoContradictions<P>

/** Homomorphic over the tuple type parameter, so it maps elements, not array methods. */
type Branches<T extends readonly unknown[]> = { [I in keyof T]: NoUnknownKeys<T[I]> }

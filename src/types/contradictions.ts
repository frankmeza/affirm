// Compile-time checks on params, intersected with P in the `affirm` signature (design §6.1, §6.4).
// Each check resolves to `unknown` when P is fine, or to an error object `{ __affirmError: '…' }`
// that the editor shows at the call site. (An error *object*, not a string: `1 & 'message'` would
// collapse to `never` and hide the text.)
import type { AffirmParams } from './params'

/** Everything the call signature intersects with P, applied at every nesting level. */
export type ParamsCheck<P> = AffirmParams extends P
  ? unknown // wide params (a variable typed AffirmParams): nothing to check, and avoids infinite recursion
  : NoUnknownKeys<P> & NoContradictions<P> & Nested<P>

/**
 * Unknown keys. Generic inference skips excess-property checks, so `{ isNull: true, isTypo: 1 }`
 * would otherwise type-check (it still throws at runtime). Shown on the key itself:
 * `… not assignable to type '{ __affirmError: "unknown check 'isTypo'" }'`.
 */
export type NoUnknownKeys<P> = {
  [K in Exclude<keyof P, keyof AffirmParams>]: { __affirmError: `unknown check '${K & string}'` }
}

/** Applies `ParamsCheck` inside composite keys: shape fields, everyItem, someItem, not, anyOf branches. */
type Nested<P> = ('shape' extends keyof P
  ? P['shape'] extends object
    ? { shape: { [F in keyof P['shape']]: ParamsCheck<P['shape'][F]> } }
    : unknown
  : unknown) &
  ('everyItem' extends keyof P ? { everyItem: ParamsCheck<P['everyItem']> } : unknown) &
  ('someItem' extends keyof P ? { someItem: ParamsCheck<P['someItem']> } : unknown) &
  ('not' extends keyof P ? { not: ParamsCheck<P['not']> } : unknown) &
  ('anyOf' extends keyof P ? (P['anyOf'] extends readonly unknown[] ? { anyOf: Branches<P['anyOf']> } : unknown) : unknown)

/** Homomorphic over the tuple type parameter, so it maps elements, not array methods. */
type Branches<T extends readonly unknown[]> = { [I in keyof T]: ParamsCheck<T[I]> }

// --- Contradictions (design §6.4) ------------------------------------------------------------
// "Keep the list small and certain. False positives are worse than misses."

/**
 * Resolves to `unknown` when P has no contradiction, or `{ __affirmError: '<message>' }` for the
 * first one found. Shown at the call site as `Property '__affirmError' is missing in type …`.
 */
export type NoContradictions<P> = ToCheck<FirstMessage<
  [
    // Not isDefined: it means "not undefined", and null passes both (design §6.4 listed it in error).
    Clash<P, 'isNull', ['isTruthy', 'isPresent', 'isUndefined']>,
    TagClash<P, 'isNull'>,
    Clash<P, 'isUndefined', ['isTruthy', 'isPresent', 'isDefined']>,
    TagClash<P, 'isUndefined'>,
    Clash<P, 'isNullish', ['isPresent']>,
    Clash<P, 'isTruthy', ['isFalsy']>,
    Clash<P, 'isEmpty', ['isNotEmpty']>,
    EmptyVsMinLength<P>,
    ArrayVsTag<P>,
    KindClash<P, 'string', NumberKeys, 'a number key'>,
    KindClash<P, 'number', StringKeys, 'a string key'>,
    MinOverMax<P>,
  ]
>>

// `[M] extends [never]`, not `M extends string`: `never` is assignable to everything, so a bare
// conditional would turn "no contradiction" into `{ __affirmError: never }` and reject every call.
type ToCheck<M> = [M] extends [never] ? unknown : { __affirmError: M }

/** Keys that only pass for numbers (any value, since gated keys fail both polarities, D7). */
type NumberKeys =
  | 'isGreaterThan'
  | 'isAtLeast'
  | 'isLessThan'
  | 'isAtMost'
  | 'isBetween'
  | 'isPositive'
  | 'isNegative'
  | 'isMultipleOf'
  | 'isInteger'
  | 'isFiniteNumber'
  | 'isNaN'

/** Keys that only pass for strings. */
type StringKeys = 'startsWith' | 'endsWith' | 'includes' | 'matches' | 'isBlank'

/** `true` when key K is present with the literal value `true`. */
type IsTrue<P, K extends PropertyKey> = K extends keyof P ? ([P[K]] extends [true] ? true : false) : false

/** `true` when key K is present and not `undefined`. */
type IsSet<P, K extends PropertyKey> = K extends keyof P ? ([P[K]] extends [undefined] ? false : true) : false

/** The `isType` tag, if `isType` is a tag literal (guards and schemas are not checked: they may allow null). */
type Tag<P> = 'isType' extends keyof P ? (P['isType'] extends string ? P['isType'] : never) : never

/** First key of Ks that is `true` in P. */
type FirstTrue<P, Ks extends readonly string[]> = Ks extends readonly [infer K extends string, ...infer R extends string[]]
  ? IsTrue<P, K> extends true
    ? K
    : FirstTrue<P, R>
  : never

/** `A: true` together with any of `Others: true`. */
type Clash<P, A extends string, Others extends readonly string[]> = IsTrue<P, A> extends true
  ? FirstTrue<P, Others> extends infer K extends string
    ? `\`${A}: true\` contradicts \`${K}: true\``
    : never
  : never

/** `isNull: true` / `isUndefined: true` with an `isType` tag. */
type TagClash<P, A extends string> = IsTrue<P, A> extends true
  ? [Tag<P>] extends [never]
    ? never
    : `\`${A}: true\` contradicts \`isType: '${Tag<P>}'\``
  : never

/** `isEmpty: true` with a literal `hasMinLength` of 1 or more. */
type EmptyVsMinLength<P> = IsTrue<P, 'isEmpty'> extends true
  ? 'hasMinLength' extends keyof P
    ? P['hasMinLength'] extends number
      ? number extends P['hasMinLength']
        ? never
        : P['hasMinLength'] extends 0
          ? never
          : `\`isEmpty: true\` contradicts \`hasMinLength: ${P['hasMinLength']}\``
      : never
    : never
  : never

/** `isArray: true` with an `isType` tag other than `'object'`. */
type ArrayVsTag<P> = IsTrue<P, 'isArray'> extends true
  ? [Tag<P>] extends [never]
    ? never
    : Tag<P> extends 'object'
      ? never
      : `\`isArray: true\` contradicts \`isType: '${Tag<P>}'\``
  : never

/** `isType: T` with a key that only passes for a different kind. */
type KindClash<P, T extends string, Keys extends string, Label extends string> = Tag<P> extends T
  ? [Tag<P>] extends [never]
    ? never
    : FirstSet<P, Keys> extends infer K extends string
      ? `\`isType: '${T}'\` contradicts \`${K}\` (${Label})`
      : never
  : never

type FirstSet<P, Keys extends string> = Keys extends unknown ? (IsSet<P, Keys> extends true ? Keys : never) : never

/** Literal `hasMinLength` greater than literal `hasMaxLength`. */
type MinOverMax<P> = 'hasMinLength' extends keyof P
  ? 'hasMaxLength' extends keyof P
    ? P['hasMinLength'] extends number
      ? P['hasMaxLength'] extends number
        ? GreaterThan<P['hasMinLength'], P['hasMaxLength']> extends true
          ? `\`hasMinLength: ${P['hasMinLength']}\` is greater than \`hasMaxLength: ${P['hasMaxLength']}\``
          : never
        : never
      : never
    : never
  : never

/** First non-never entry of a tuple of messages. */
type FirstMessage<T extends readonly unknown[]> = T extends readonly [infer H, ...infer R]
  ? [H] extends [never]
    ? FirstMessage<R>
    : H
  : never

// --- Type-level comparison of non-negative integer literals ----------------------------------
// Only literal, non-negative integers are compared (`hasLength` params); anything else → false,
// so a wide `number` or a decimal never produces a (possibly false) contradiction.

type Digits<N extends number> = number extends N
  ? never
  : `${N}` extends `${infer S}`
    ? S extends `${string}${'.' | 'e' | '-'}${string}`
      ? never
      : S
    : never

type Length<S extends string, Acc extends unknown[] = []> = S extends `${string}${infer R}`
  ? Length<R, [...Acc, 0]>
  : Acc

type LongerThan<A extends unknown[], B extends unknown[]> = A extends [...B, unknown, ...unknown[]] ? true : false

type DigitGreater<A extends string, B extends string> = A extends B
  ? false
  : '0123456789' extends `${string}${B}${string}${A}${string}`
    ? true
    : false

/** Same-length digit strings, compared left to right. */
type DigitsGreater<A extends string, B extends string> = A extends `${infer a}${infer ra}`
  ? B extends `${infer b}${infer rb}`
    ? a extends b
      ? DigitsGreater<ra, rb>
      : DigitGreater<a, b>
    : false
  : false

export type GreaterThan<A extends number, B extends number> = [Digits<A>, Digits<B>] extends [
  infer DA extends string,
  infer DB extends string,
]
  ? [DA] extends [never]
    ? false
    : [DB] extends [never]
      ? false
      : LongerThan<Length<DA>, Length<DB>> extends true
        ? true
        : LongerThan<Length<DB>, Length<DA>> extends true
          ? false
          : DigitsGreater<DA, DB>
  : false

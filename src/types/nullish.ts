// Boolean keys: `true` asserts, `false` asserts the negation (D1).
import type { BoolInfo, Exact, ParamOf, Refine } from './narrowing.js'

export interface NullishParams {
  /**
   * Value is `null` (`true`) or is not `null` (`false`).
   *
   * Passes when `(value === null) === param`. `undefined` is not `null`.
   * Narrows to `null` / `{} | undefined`, exact in both polarities.
   *
   * @example
   * if (affirm(user.deletedAt, { isNull: true })) { … } // never deleted
   */
  isNull?: boolean
  /**
   * Value is `undefined` (`true`) or is not `undefined` (`false`).
   *
   * Passes when `(value === undefined) === param`. Narrows to `undefined` / `{} | null`, exact.
   *
   * @example
   * affirm(options.timeout, { isUndefined: true })
   */
  isUndefined?: boolean
  /**
   * Value is `null` or `undefined` (`true`), or neither (`false`).
   *
   * Passes when `(value == null) === param`. Narrows to `null | undefined` / `{}`, exact.
   * For "null or empty", use `anyOf: [{ isNullish: true }, { isEmpty: true }]`.
   *
   * @example
   * if (affirm(input, { isNullish: true })) return defaultValue
   */
  isNullish?: boolean
  /**
   * Value is not `undefined` (`true`), or is `undefined` (`false`). `null` counts as defined.
   *
   * Passes when `(value !== undefined) === param`. Narrows to `{} | null` / `undefined`, exact.
   * To exclude both `null` and `undefined`, use `isPresent`.
   *
   * @example
   * affirm(patch.nickname, { isDefined: true }) // null allowed: it clears the nickname
   */
  isDefined?: boolean
  /**
   * Value is neither `null` nor `undefined` (`true`), or is one of them (`false`).
   *
   * Passes when `(value != null) === param`. Narrows to `{}` / `null | undefined`, exact.
   * `0`, `''` and `false` are present.
   *
   * @example
   * if (affirm(user, { isPresent: true })) { user.id } // user: User (no longer User | null)
   */
  isPresent?: boolean
  /**
   * Value is truthy (`true`) or falsy (`false`).
   *
   * Passes when `Boolean(value) === param`. `true` narrows to `{}` (refined: the `else` branch
   * keeps everything, since `0` and `''` are present but falsy). `false` does not narrow.
   *
   * @example
   * affirm(token, { isTruthy: true })
   */
  isTruthy?: boolean
  /**
   * Value is falsy (`true`) or truthy (`false`): `false`, `0`, `-0`, `0n`, `''`, `null`, `undefined`, `NaN`.
   *
   * Passes when `!value === param`. `false` narrows to `{}` (refined); `true` does not narrow.
   *
   * @example
   * affirm(errorMessage, { isFalsy: true })
   */
  isFalsy?: boolean
}

// Narrowing table: design §5 "Nullish & truthiness".
export type NullishInfos<P> = [
  BoolInfo<ParamOf<P, 'isNull'>, Exact<null>, Exact<{} | undefined>>,
  BoolInfo<ParamOf<P, 'isUndefined'>, Exact<undefined>, Exact<{} | null>>,
  BoolInfo<ParamOf<P, 'isNullish'>, Exact<null | undefined>, Exact<{}>>,
  BoolInfo<ParamOf<P, 'isDefined'>, Exact<{} | null>, Exact<undefined>>,
  BoolInfo<ParamOf<P, 'isPresent'>, Exact<{}>, Exact<null | undefined>>,
  BoolInfo<ParamOf<P, 'isTruthy'>, Refine<{}>, Refine>,
  BoolInfo<ParamOf<P, 'isFalsy'>, Refine, Refine<{}>>,
]

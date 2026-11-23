// Every params key affirm accepts, for recognising params objects by their keys (const-params).
// A static copy, so the plugin doesn't bundle the runtime checks; `eslint-check-keys.test.ts` fails
// if it drifts from `src/core/registry.ts`.
export const CHECK_KEYS: ReadonlySet<string> = new Set([
  'isNull', 'isUndefined', 'isNullish', 'isDefined', 'isPresent', 'isTruthy', 'isFalsy',
  'isType', 'isArray', 'isPlainObject', 'isFunction', 'isInstanceOf', 'isValidDate', 'isInteger', 'isFiniteNumber', 'isNaN',
  'is', 'isNot', 'isOneOf', 'isNotOneOf', 'isDeepEqual',
  'isEmpty', 'isNotEmpty', 'isBlank', 'hasLength', 'hasMinLength', 'hasMaxLength',
  'isGreaterThan', 'isAtLeast', 'isLessThan', 'isAtMost', 'isBetween', 'isPositive', 'isNegative', 'isMultipleOf',
  'startsWith', 'endsWith', 'includes', 'matches',
  'shape', 'hasKey', 'hasKeys', 'hasAnyKey', 'hasOnlyKeys', 'hasPath',
  'contains', 'containsAll', 'containsAny', 'everyItem', 'someItem',
  'not', 'anyOf', 'satisfies',
])

/**
 * Check names that are ordinary words in other objects (`{ shape: 'circle' }`, a manifest's `matches`,
 * JSON Schema's `anyOf` / `not` / `contains`). An object made only of these is not taken for params
 * unless its nested params are distinctive.
 */
export const GENERIC_KEYS: ReadonlySet<string> = new Set([
  'is', 'not', 'anyOf', 'shape', 'includes', 'matches', 'contains', 'startsWith', 'endsWith', 'satisfies',
])

import { booleanLeaf, leaf, nonNegativeIntegerParam, Phase, type CheckGroup } from '../core/check-def'
import { isMeasurable, isPlainObject, isString, sizeOf, type Measurable } from '../core/util/kind'
import type { SizeParams } from '../types/size'

const MEASURABLE = 'a string, array, Map or Set'

/** isEmpty / isNotEmpty also accept plain objects (own enumerable keys). */
type Sizable = Measurable | Record<string, unknown>
const isSizable = (value: unknown): value is Sizable => isMeasurable(value) || isPlainObject(value)
const sizeOfSizable = (value: Sizable): number =>
  isMeasurable(value) ? sizeOf(value) : Object.keys(value).length
const SIZABLE = 'a string, array, Map, Set or plain object'

export const sizeChecks = {
  isEmpty: booleanLeaf<Sizable>({
    phase: Phase.Measure,
    accepts: isSizable,
    acceptsLabel: SIZABLE,
    test: (value) => sizeOfSizable(value) === 0,
    expected: 'empty',
    expectedNot: 'not empty',
  }),

  isNotEmpty: booleanLeaf<Sizable>({
    phase: Phase.Measure,
    accepts: isSizable,
    acceptsLabel: SIZABLE,
    test: (value) => sizeOfSizable(value) > 0,
    expected: 'not empty',
    expectedNot: 'empty',
  }),

  isBlank: booleanLeaf<string>({
    phase: Phase.Measure,
    accepts: isString,
    acceptsLabel: 'a string',
    test: (value) => value.trim() === '',
    expected: 'a blank string',
    expectedNot: 'a non-blank string',
  }),

  hasLength: leaf<number, Measurable>({
    phase: Phase.Measure,
    validateParam: nonNegativeIntegerParam,
    accepts: isMeasurable,
    acceptsLabel: MEASURABLE,
    test: (value, n) => sizeOf(value) === n,
    expected: (n) => `length === ${n}`,
  }),

  hasMinLength: leaf<number, Measurable>({
    phase: Phase.Measure,
    validateParam: nonNegativeIntegerParam,
    accepts: isMeasurable,
    acceptsLabel: MEASURABLE,
    test: (value, n) => sizeOf(value) >= n,
    expected: (n) => `length >= ${n}`,
  }),

  hasMaxLength: leaf<number, Measurable>({
    phase: Phase.Measure,
    validateParam: nonNegativeIntegerParam,
    accepts: isMeasurable,
    acceptsLabel: MEASURABLE,
    test: (value, n) => sizeOf(value) <= n,
    expected: (n) => `length <= ${n}`,
  }),
} satisfies CheckGroup<SizeParams>

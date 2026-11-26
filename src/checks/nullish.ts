import { booleanLeaf, Phase, type CheckGroup } from '../core/check-def.js'
import type { NullishParams } from '../types/nullish.js'

export const nullishChecks = {
  isNull: booleanLeaf({
    phase: Phase.Kind,
    test: (value) => value === null,
    expected: 'null',
    expectedNot: 'not null',
  }),

  isUndefined: booleanLeaf({
    phase: Phase.Kind,
    test: (value) => value === undefined,
    expected: 'undefined',
    expectedNot: 'not undefined',
  }),

  isNullish: booleanLeaf({
    phase: Phase.Kind,
    test: (value) => value === null || value === undefined,
    expected: 'null or undefined',
    expectedNot: 'not null or undefined',
  }),

  isDefined: booleanLeaf({
    phase: Phase.Kind,
    test: (value) => value !== undefined,
    expected: 'defined (not undefined)',
    expectedNot: 'undefined',
  }),

  isPresent: booleanLeaf({
    phase: Phase.Kind,
    test: (value) => value !== null && value !== undefined,
    expected: 'present (not null or undefined)',
    expectedNot: 'null or undefined',
  }),

  isTruthy: booleanLeaf({
    phase: Phase.Kind,
    test: (value) => Boolean(value),
    expected: 'truthy',
    expectedNot: 'falsy',
  }),

  isFalsy: booleanLeaf({
    phase: Phase.Kind,
    test: (value) => !value,
    expected: 'falsy',
    expectedNot: 'truthy',
  }),
} satisfies CheckGroup<NullishParams>

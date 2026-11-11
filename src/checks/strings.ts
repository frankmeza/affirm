import { leaf, Phase, stringParam, type CheckGroup } from '../core/check-def'
import { formatParam } from '../core/describe'
import { isString } from '../core/util/kind'
import type { StringParams } from '../types/strings'

const MAX_REGEX_SHOWN = 40

function formatRegExp(re: RegExp): string {
  const text = String(re)
  return text.length <= MAX_REGEX_SHOWN ? text : `${text.slice(0, MAX_REGEX_SHOWN)}…`
}

export const stringChecks = {
  startsWith: leaf<string, string>({
    phase: Phase.Measure,
    validateParam: stringParam,
    accepts: isString,
    acceptsLabel: 'a string',
    test: (value, prefix) => value.startsWith(prefix),
    expected: (prefix) => `a string starting with ${formatParam(prefix)}`,
  }),

  endsWith: leaf<string, string>({
    phase: Phase.Measure,
    validateParam: stringParam,
    accepts: isString,
    acceptsLabel: 'a string',
    test: (value, suffix) => value.endsWith(suffix),
    expected: (suffix) => `a string ending with ${formatParam(suffix)}`,
  }),

  includes: leaf<string, string>({
    phase: Phase.Measure,
    validateParam: stringParam,
    accepts: isString,
    acceptsLabel: 'a string',
    test: (value, part) => value.includes(part),
    expected: (part) => `a string including ${formatParam(part)}`,
  }),

  matches: leaf<RegExp, string>({
    phase: Phase.Measure,
    validateParam: (param) =>
      param instanceof RegExp ? undefined : `a RegExp (received ${formatParam(param)}); use \`includes\` for plain text`,
    accepts: isString,
    acceptsLabel: 'a string',
    test: (value, re) => {
      re.lastIndex = 0 // /g and /y regexes keep state between calls
      return re.test(value)
    },
    expected: (re) => `a string matching ${formatRegExp(re)}`,
  }),
} satisfies CheckGroup<StringParams>

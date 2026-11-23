import type { Rule } from 'eslint'
import { carrier, functionName, guardPatternOf, isAffirmCall, sourcesOf, wrapperOf, type Node } from './shared'

// Design D8, cross-file part. ESLint checks one file at a time, so `no-negated-affirm` can't tell
// that an imported `isValidOrder` returns affirm(…). This rule makes the name carry that fact:
// with `settings.affirm.guards` set (e.g. "^isValid"), a named function returns affirm(…) if and
// only if its name matches the pattern. `no-negated-affirm` then flags `!isValidOrder(x)` in any
// file. Without the setting this rule does nothing.

export const guardNaming: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'With `settings.affirm.guards`, require functions that return affirm(…) to match the guard pattern, and reserve the pattern for them.',
    },
    schema: [],
    messages: {
      unnamedGuard:
        "affirm: `{{name}}` returns affirm(…), so its name must match the guard pattern `{{pattern}}` (settings.affirm.guards). " +
        'That lets affirm/no-negated-affirm catch `!{{name}}(…)` in the files that import it.',
      reservedName:
        "affirm: `{{name}}` matches the guard pattern `{{pattern}}` (settings.affirm.guards), which is reserved for functions whose whole body returns affirm(…). " +
        'Rename it, or make it return affirm(…) (negating it is reported as negating a guard).',
    },
  },

  create(context) {
    const guards = guardPatternOf(context)
    if (guards === undefined) return {}
    const sources = sourcesOf(context)
    const { sourceCode } = context

    const wrappers = new Set<Node>()
    const named = new Map<Node, { name: string; node: Node }>()

    function collect(fn: Node): void {
      const binding = functionName(fn)
      if (binding !== undefined && guards!.test(binding.name)) named.set(fn, binding)
    }

    return {
      FunctionDeclaration: collect,
      FunctionExpression: collect,
      ArrowFunctionExpression: collect,

      CallExpression(node) {
        if (!isAffirmCall(node, sourceCode, sources)) return
        const wrapper = wrapperOf(carrier(node))
        if (wrapper === undefined || wrappers.has(wrapper)) return // `check(a) && check(b)`: one function, one report
        wrappers.add(wrapper)
        const binding = functionName(wrapper) // undefined for inline callbacks such as `.filter((r) => affirm(r, p))`
        if (binding !== undefined && !guards.test(binding.name)) {
          context.report({ node: binding.node, messageId: 'unnamedGuard', data: { name: binding.name, pattern: guards.source } })
        }
      },

      'Program:exit'() {
        for (const [fn, binding] of named) {
          if (wrappers.has(fn)) continue
          context.report({ node: binding.node, messageId: 'reservedName', data: { name: binding.name, pattern: guards.source } })
        }
      },
    }
  },
}

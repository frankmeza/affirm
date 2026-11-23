import type { Rule, Scope, SourceCode } from 'eslint'
import {
  ADVICE,
  assignedOnce,
  calleeName,
  carrier,
  functionVariable,
  guardModulesOf,
  guardPatternOf,
  isAffirmCall,
  isProjectCall,
  negationOf,
  outermost,
  sourcesOf,
  truncate,
  usageText,
  wrapperOf,
  type Node,
} from './shared'

// Design D8: `affirm(value, params)` is an AND of narrow checks, so its negation means "some
// check failed, for some reason", which is too broad to build on. This rule forbids negating it.

interface Options {
  /** Module specifiers that export `affirm`. Overrides `settings.affirm.sources`. */
  sources?: string[]
}

/**
 * `if (!affirm(v, p)) throw new X('msg')` → `affirm.assert(v, p, 'msg')`. A suggestion, never an autofix:
 * the thrown error becomes an `AffirmError`.
 */
function assertSuggestion(negation: Node, call: Node, sourceCode: SourceCode): Rule.SuggestionReportDescriptor | undefined {
  const statement = negation.parent
  if (negation.type !== 'UnaryExpression' || statement?.type !== 'IfStatement') return undefined
  if (statement.test !== negation || statement.alternate) return undefined
  if (call.type !== 'CallExpression' || call.optional || call.arguments.length < 2) return undefined
  const consequent = statement.consequent
  const thrown =
    consequent.type === 'ThrowStatement'
      ? consequent
      : consequent.type === 'BlockStatement' && consequent.body.length === 1 && consequent.body[0]!.type === 'ThrowStatement'
        ? consequent.body[0]
        : undefined
  if (thrown === undefined) return undefined

  const args = call.arguments as Node[]
  const argsText = sourceCode.text.slice(args[0]!.range![0], args[args.length - 1]!.range![1])
  const error = thrown.argument as Node
  let message = ''
  if (error.type === 'NewExpression' && error.arguments.length === 1) {
    const arg = error.arguments[0] as Node
    const plainText = (arg.type === 'Literal' && typeof arg.value === 'string') || (arg.type === 'TemplateLiteral' && arg.expressions.length === 0)
    if (plainText) message = `, ${sourceCode.getText(arg)}`
  }
  const replacement = `${sourceCode.getText(call.callee as Node)}.assert(${argsText}${message})`
  return {
    messageId: 'suggestAssert',
    data: { replacement: truncate(replacement.replace(/\s+/g, ' ')) },
    fix: (fixer) => fixer.replaceText(statement, replacement),
  }
}

export const noNegatedAffirm: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow negating affirm() (`!affirm(…)`, `affirm(…) === false`, …): its negation is too broad to rely on.',
    },
    hasSuggestions: true,
    schema: [
      {
        type: 'object',
        properties: { sources: { type: 'array', items: { type: 'string' }, minItems: 1 } },
        additionalProperties: false,
      },
    ],
    messages: {
      negated: `affirm: \`{{usage}}\` is not allowed. ${ADVICE}`,
      negatedResult: `affirm: \`{{usage}}\` negates the affirm() result stored in \`{{name}}\`, which is not allowed. ${ADVICE}`,
      negatedWrapper: `affirm: \`{{usage}}\` negates \`{{name}}\`, which returns affirm(…), which is not allowed. ${ADVICE}`,
      negatedGuard: `affirm: \`{{usage}}\` negates \`{{name}}\`, a guard built on affirm() (its name matches the guard pattern \`{{pattern}}\`), which is not allowed. ${ADVICE}`,
      suggestAssert: 'Replace with `{{replacement}}` (throws AffirmError with the full report instead).',
    },
  },

  create(context) {
    const { sourceCode } = context
    const options = (context.options[0] ?? {}) as Options
    const sources = sourcesOf(context, options.sources)
    const guards = guardPatternOf(context)
    const guardModules = guardModulesOf(context)

    const reported = new Set<Node>()

    interface Problem {
      messageId: string
      data: Record<string, string>
      suggest?: Rule.SuggestionReportDescriptor[]
    }

    function report(negation: Node, problem: Problem): void {
      if (reported.has(negation)) return // `!(affirm(a) && affirm(b))` is one problem, not two
      reported.add(negation)
      context.report({ node: negation, ...problem })
    }

    /** Reports negated reads of a variable holding an affirm() result, or calls of a wrapper function. */
    function checkVariable(variable: Scope.Variable, asWrapper: boolean): void {
      if (!assignedOnce(variable)) return
      for (const reference of variable.references) {
        if (!reference.isRead()) continue
        let value = reference.identifier as Node
        if (asWrapper) {
          const call = value.parent
          if (call?.type !== 'CallExpression' || call.callee !== value) continue
          value = call
        }
        const negation = negationOf(carrier(value))
        if (negation === undefined) continue
        report(negation, {
          messageId: asWrapper ? 'negatedWrapper' : 'negatedResult',
          data: { usage: usageText(sourceCode, negation), name: variable.name },
        })
      }
    }

    return {
      CallExpression(node) {
        if (!isAffirmCall(node, sourceCode, sources)) {
          // A guard from anywhere (usually another file): its name matches `settings.affirm.guards`.
          const name = calleeName(node)
          if (guards === undefined || name === undefined || !guards.test(name)) return
          if (!isProjectCall(node, sourceCode, guardModules)) return // a third-party `isValid…` is not our guard
          const negation = negationOf(carrier(node))
          if (negation !== undefined) {
            report(negation, { messageId: 'negatedGuard', data: { usage: usageText(sourceCode, negation), name, pattern: guards.source } })
          }
          return
        }
        const value = carrier(node)

        // `!affirm(…)`, `!(affirm(…) && x)`, `affirm(…) === false`, …
        const negation = negationOf(value)
        if (negation !== undefined) {
          const suggestion = value === outermost(node) ? assertSuggestion(negation, node, sourceCode) : undefined
          report(negation, {
            messageId: 'negated',
            data: { usage: usageText(sourceCode, negation) },
            ...(suggestion ? { suggest: [suggestion] } : {}),
          })
          return
        }

        // `const ok = affirm(…)` (or a `let` / `var` never reassigned), later `!ok`.
        const declarator = value.parent
        if (declarator?.type === 'VariableDeclarator' && declarator.init === value && declarator.id.type === 'Identifier') {
          for (const variable of sourceCode.getDeclaredVariables(declarator)) checkVariable(variable, false)
          return
        }

        // A same-file wrapper, `const isOrder = (v) => affirm(v, p)`, later `!isOrder(x)`.
        const wrapper = wrapperOf(value)
        const variable = wrapper && functionVariable(wrapper, sourceCode)
        if (variable) checkVariable(variable, true)
      },
    }
  },
}

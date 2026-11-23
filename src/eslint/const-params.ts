import type { Rule, Scope, SourceCode } from 'eslint'
import { CHECK_KEYS, GENERIC_KEYS } from './check-keys'
import { findVariable, sourcesOf, takesAffirmParams, type Node } from './shared'

// Hoisted params lose their literal types: `const p = { isOneOf: ['a', 'b'] }` is typed
// `{ isOneOf: string[] }` before affirm() ever sees it, so narrowing silently weakens
// (docs/client-usage.md §8.1). affirm can't recover the literals, so this rule asks for `as const`
// where the params are declared. TypeScript files only: `as const` is not JavaScript.
//
// Params are found two ways: by following what is passed to affirm() in this file, and by their
// keys, wherever they are declared. The second covers params exported to other files, which a
// one-file-at-a-time linter can't follow (design D10).

const TS_FILE = /\.[cm]?tsx?$/

/** Nodes that wrap an expression without changing what it is, for walking into params. */
const WRAPPERS = new Set(['TSAsExpression', 'TSSatisfiesExpression', 'TSNonNullExpression', 'TSTypeAssertion'])

interface Finding {
  variable: Scope.Variable
  /** The declared name, where the problem is reported. */
  id: Node
  /** The object or array literal the params are written as. */
  literal: Node
  /** `plain`: no `as const`. `typed`: an annotation or `as T` cast erases the literal types. */
  kind: 'plain' | 'typed'
  /** For `typed`: the type node, and the node to remove (`: T` annotation or the whole `as T` cast). */
  type?: Node
  cast?: Node
}

function isAsConst(node: Node): boolean {
  if ((node.type as string) !== 'TSAsExpression') return false
  const type = (node as unknown as { typeAnnotation: { type: string; typeName?: { type: string; name?: string } } }).typeAnnotation
  return type.type === 'TSTypeReference' && type.typeName?.type === 'Identifier' && type.typeName.name === 'const'
}

const isLiteral = (node: Node | null | undefined): boolean => node?.type === 'ObjectExpression' || node?.type === 'ArrayExpression'

function expressionOf(node: Node): Node {
  return (node as unknown as { expression: Node }).expression
}

/** Whether a reference sits inside a type query (`typeof p` in a type), which `as const` only improves. */
function inTypeQuery(identifier: Node): boolean {
  for (let n: Node | null = identifier.parent; n !== null; n = n.parent) {
    if ((n.type as string) === 'TSTypeQuery') return true
    if (!(n.type as string).startsWith('TS') && n.type !== 'MemberExpression') return false
  }
  return false
}

/** A property's static key: `isOneOf`, `'isOneOf'`. */
function keyOf(property: Node): string | undefined {
  if (property.type !== 'Property' || property.computed) return undefined
  const key = property.key as Node
  if (key.type === 'Identifier') return key.name
  return key.type === 'Literal' && typeof key.value === 'string' ? key.value : undefined
}

/** Keys whose value is itself params (or, for `shape`, an object of params; for `anyOf`, a list of params). */
function nestedParams(key: string, value: Node): Node[] {
  if (key === 'not' || key === 'everyItem' || key === 'someItem') return [value]
  if (key === 'shape' && value.type === 'ObjectExpression') return value.properties.flatMap((p) => (p.type === 'Property' ? [p.value as Node] : []))
  if (key === 'anyOf' && value.type === 'ArrayExpression') return value.elements.filter((e): e is NonNullable<typeof e> & Node => e?.type === 'ObjectExpression')
  return []
}

/**
 * Whether an object literal is unmistakably affirm params: every key is a check name, and at least
 * one key (here or in nested params) is distinctive. `{ isOneOf: […] }` and `{ shape: { id: { isType: 'string' } } }`
 * are params; `{ shape: 'circle' }`, a manifest's `{ matches: […] }` and JSON Schema's `{ anyOf: […] }` are not.
 */
function looksLikeParams(node: Node | null | undefined, depth = 0): boolean {
  if (node?.type !== 'ObjectExpression' || depth > 8) return false
  const keyed = node.properties.filter((p) => p.type === 'Property')
  if (keyed.length === 0) return false
  let distinctive = false
  for (const property of keyed) {
    const key = keyOf(property as Node)
    if (key === undefined || !CHECK_KEYS.has(key)) return false
    if (!GENERIC_KEYS.has(key)) distinctive = true
  }
  if (distinctive) return true
  return keyed.some((property) => nestedParams(keyOf(property as Node)!, property.value as Node).some((inner) => looksLikeParams(inner, depth + 1)))
}

/** The object literal a declaration is written as, under `satisfies` / `as` (including `as const`). */
function literalOf(init: Node | null | undefined): Node | undefined {
  let node = init
  while (node && WRAPPERS.has(node.type as string)) node = expressionOf(node)
  return node ?? undefined
}

/**
 * What's wrong with a `const` declaration used as params, if anything:
 * `{…}` → plain; `: T = {…}` or `{…} as T` → typed. `{…} as const` (optionally `satisfies T`) is fine.
 */
function classify(declarator: Node, variable: Scope.Variable): Finding | undefined {
  if (declarator.type !== 'VariableDeclarator' || declarator.id.type !== 'Identifier' || !declarator.init) return undefined
  const id = declarator.id as Node & { typeAnnotation?: { typeAnnotation: Node } }
  let init = declarator.init as Node
  if ((init.type as string) === 'TSSatisfiesExpression') init = expressionOf(init)
  if (isAsConst(init)) return undefined
  if ((init.type as string) === 'TSAsExpression' && isLiteral(expressionOf(init))) {
    const type = (init as unknown as { typeAnnotation: Node }).typeAnnotation
    return { variable, id, literal: expressionOf(init), kind: 'typed', type, cast: init }
  }
  if (!isLiteral(init)) return undefined
  if (id.typeAnnotation) return { variable, id, literal: init, kind: 'typed', type: id.typeAnnotation.typeAnnotation }
  return { variable, id, literal: init, kind: 'plain' }
}

/** `{…} as const`, or for a typed declaration `{…} as const satisfies T` (keeps the type check). */
function fixFor(finding: Finding, sourceCode: SourceCode): Rule.ReportFixer {
  return (fixer) => {
    if (finding.kind === 'plain') return fixer.insertTextAfter(finding.literal, ' as const')
    const typeText = sourceCode.getText(finding.type!)
    if (finding.cast) return fixer.replaceText(finding.cast, `${sourceCode.getText(finding.literal)} as const satisfies ${typeText}`)
    const annotation = (finding.id as Node & { typeAnnotation: Node }).typeAnnotation
    return [fixer.remove(annotation), fixer.insertTextAfter(finding.literal, ` as const satisfies ${typeText}`)]
  }
}

export const constParams: Rule.RuleModule = {
  meta: {
    type: 'problem',
    fixable: 'code',
    hasSuggestions: true,
    docs: {
      description: 'Require `as const` on params declared apart from the affirm() call, so their literal types (and narrowing) survive.',
    },
    schema: [],
    messages: {
      needsConst:
        "affirm: params `{{name}}` need `as const`. Without it TypeScript widens their values ('a' → string, true → boolean) " +
        'before affirm() sees them, so narrowing is silently lost. Declare `const {{name}} = { … } as const`.',
      typed:
        'affirm: params `{{name}}` are typed as `{{type}}`, which erases their exact values, so affirm() can only narrow ' +
        'with the general type. Use `as const satisfies {{type}}` instead: it keeps both the type check and the exact values.',
      suggestConst: 'Add `as const` (`{{name}}` is also used outside affirm params; check those uses still compile).',
      suggestTyped: 'Replace the `{{type}}` type with `as const satisfies {{type}}`.',
    },
  },

  create(context) {
    if (!TS_FILE.test(context.filename)) return {}
    const { sourceCode } = context
    const sources = sourcesOf(context)

    const paramRefs = new Set<Node>() // identifiers used in a params position
    const seen = new Set<Scope.Variable>()
    const findings: Finding[] = []

    /** Visits everything that ends up in params: the literal, nested values, spreads, and hoisted variables. */
    function walk(node: Node | null | undefined): void {
      if (!node) return
      if (WRAPPERS.has(node.type as string)) return walk(expressionOf(node))
      if (node.type === 'ObjectExpression') {
        for (const property of node.properties) walk((property.type === 'SpreadElement' ? property.argument : property.value) as Node)
      } else if (node.type === 'ArrayExpression') {
        for (const element of node.elements) walk((element?.type === 'SpreadElement' ? element.argument : element) as Node | null)
      } else if (node.type === 'Identifier') {
        paramRefs.add(node)
        inspect(findVariable(sourceCode.getScope(node), node.name))
      }
    }

    /** Checks a `const` that holds params (once), then everything inside it: nested hoisted params need `as const` too. */
    function inspect(variable: Scope.Variable | undefined): void {
      if (variable === undefined || seen.has(variable)) return
      seen.add(variable)
      const def = variable.defs[0]
      if (def?.type !== 'Variable' || (def.parent as { kind?: string } | null)?.kind !== 'const') return
      const finding = classify(def.node as Node, variable)
      if (finding) findings.push(finding)
      walk((def.node as Node & { init?: Node }).init)
    }

    return {
      CallExpression(node) {
        if (takesAffirmParams(node, sourceCode, sources)) walk(node.arguments[1] as Node | undefined)
      },

      // Params recognised by their keys, even if this file never passes them to affirm() (e.g. exported ones).
      VariableDeclarator(node) {
        if (node.id.type !== 'Identifier' || (node.parent as { kind?: string }).kind !== 'const') return
        if (!looksLikeParams(literalOf(node.init as Node | null))) return
        for (const variable of sourceCode.getDeclaredVariables(node)) inspect(variable)
      },

      'Program:exit'() {
        for (const finding of findings) {
          const name = finding.variable.name
          const fix = fixFor(finding, sourceCode)
          if (finding.kind === 'typed') {
            const type = sourceCode.getText(finding.type!)
            context.report({ node: finding.id, messageId: 'typed', data: { name, type }, suggest: [{ messageId: 'suggestTyped', data: { type }, fix }] })
            continue
          }
          // Autofix only when every use is as params (or `typeof` in a type): then `as const` can't break anything.
          const onlyParams = finding.variable.references.every(
            (ref) => ref.identifier === finding.id || paramRefs.has(ref.identifier as Node) || inTypeQuery(ref.identifier as Node),
          )
          context.report({
            node: finding.id,
            messageId: 'needsConst',
            data: { name },
            ...(onlyParams ? { fix } : { suggest: [{ messageId: 'suggestConst', data: { name }, fix }] }),
          })
        }
      },
    }
  },
}

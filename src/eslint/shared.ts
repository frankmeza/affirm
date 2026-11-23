import type { Rule, Scope, SourceCode } from 'eslint'

// Helpers shared by the affirm ESLint rules (design D8). Only ESLint types are imported, so the
// plugin has no runtime dependencies (design §2).

export type Node = Rule.Node

const MAX_USAGE = 60

export const ADVICE =
  'Negating affirm() is true when any check fails for any reason, so it tells you nothing reliable about the value. ' +
  'Use affirm.assert(value, params) to stop on bad data, affirm.explain(value, params) to handle failures by reason, ' +
  'or a positive check for the state you mean (e.g. `isNullish: true`).'

/** Wrappers that don't change the value: `affirm?.()`, `affirm() as boolean`, `affirm()!`, … (parentheses aren't nodes). */
const TRANSPARENT = new Set(['ChainExpression', 'TSAsExpression', 'TSSatisfiesExpression', 'TSNonNullExpression', 'TSTypeAssertion'])

/** The outermost transparent wrapper around `node`. */
export function outermost(node: Node): Node {
  let current = node
  while (current.parent !== null && TRANSPARENT.has(current.parent.type)) current = current.parent
  return current
}

/**
 * The whole expression carrying a value's result through `&&` / `||` (and transparent wrappers):
 * for `affirm(a) && ok` that is the `&&` expression. Negating it negates the affirm() inside.
 */
export function carrier(node: Node): Node {
  let current = outermost(node)
  while (current.parent?.type === 'LogicalExpression' && current.parent.operator !== '??') current = outermost(current.parent)
  return current
}

/** `!x`, `x === false`, `x == false`, `x !== true`, `x != true` (either side): the node that negates `expr`, if any. */
export function negationOf(expr: Node): Node | undefined {
  const value = outermost(expr)
  const parent = value.parent
  if (parent?.type === 'UnaryExpression' && parent.operator === '!') return parent
  if (parent?.type === 'BinaryExpression') {
    const other = (parent.left === value ? parent.right : parent.left) as Node
    if (other.type !== 'Literal' || typeof other.value !== 'boolean') return undefined
    const equals = parent.operator === '===' || parent.operator === '=='
    const differs = parent.operator === '!==' || parent.operator === '!='
    if ((equals && other.value === false) || (differs && other.value === true)) return parent
  }
  return undefined
}

/** One assignment at most (its initializer), so every read sees the same value. */
export function assignedOnce(variable: Scope.Variable): boolean {
  return variable.references.filter((reference) => reference.isWrite()).length <= 1
}

/** The variable a function is bound to: `function f() {}`, `const f = () => …`, `const f = function () {}`. */
export function functionVariable(fn: Node, sourceCode: SourceCode): Scope.Variable | undefined {
  if (fn.type === 'FunctionDeclaration') {
    return fn.id ? sourceCode.getDeclaredVariables(fn).find((v) => v.name === fn.id!.name) : undefined
  }
  const declarator = outermost(fn).parent
  if (declarator?.type !== 'VariableDeclarator' || declarator.init !== outermost(fn) || declarator.id.type !== 'Identifier') return undefined
  return sourceCode.getDeclaredVariables(declarator)[0]
}

/**
 * The function whose entire body is `value`: `(v) => value`, or a body that is only `return value`.
 * Calling such a function is the same as evaluating `value`.
 */
export function wrapperOf(value: Node): Node | undefined {
  const parent = value.parent
  if (parent?.type === 'ArrowFunctionExpression' && parent.body === value) return parent
  if (parent?.type !== 'ReturnStatement') return undefined
  const block = parent.parent
  if (block?.type !== 'BlockStatement' || block.body.length !== 1) return undefined
  const fn = block.parent
  const isFunction = fn?.type === 'FunctionDeclaration' || fn?.type === 'FunctionExpression' || fn?.type === 'ArrowFunctionExpression'
  return isFunction ? fn : undefined
}

export function findVariable(scope: Scope.Scope | null, name: string): Scope.Variable | undefined {
  for (let s = scope; s !== null; s = s.upper) {
    const variable = s.set.get(name)
    if (variable !== undefined) return variable
  }
  return undefined
}

/** `'named'` for `import { affirm }` (any local name), `'namespace'` for `import * as ns`, from one of `sources`. */
function importKind(variable: Scope.Variable | undefined, sources: ReadonlySet<string>): 'named' | 'namespace' | undefined {
  const def = variable?.defs[0]
  if (def?.type !== 'ImportBinding') return undefined
  const declaration = def.parent as { source?: { value?: unknown } } | null
  if (!sources.has(declaration?.source?.value as string)) return undefined
  const spec = def.node as { type: string; imported?: { type: string; name?: string; value?: unknown } }
  if (spec.type === 'ImportNamespaceSpecifier') return 'namespace'
  if (spec.type !== 'ImportSpecifier') return undefined
  const imported = spec.imported?.type === 'Identifier' ? spec.imported.name : spec.imported?.value
  return imported === 'affirm' ? 'named' : undefined
}

/** `affirm(…)`, `check(…)` (aliased import) or `ns.affirm(…)` / `ns['affirm'](…)` (namespace import). */
export function isAffirmCall(node: Node, sourceCode: SourceCode, sources: ReadonlySet<string>): boolean {
  if (node.type !== 'CallExpression') return false
  const callee = node.callee as Node
  const scope = sourceCode.getScope(node)
  if (callee.type === 'Identifier') return importKind(findVariable(scope, callee.name), sources) === 'named'
  if (callee.type === 'MemberExpression' && callee.object.type === 'Identifier') {
    const property = callee.computed
      ? callee.property.type === 'Literal'
        ? callee.property.value
        : undefined
      : callee.property.type === 'Identifier'
        ? callee.property.name
        : undefined
    return property === 'affirm' && importKind(findVariable(scope, callee.object.name), sources) === 'namespace'
  }
  return false
}

export function truncate(text: string): string {
  return text.length <= MAX_USAGE ? text : `${text.slice(0, MAX_USAGE - 1)}…`
}

/** The offending code, on one line, shortened for the message. */
export function usageText(sourceCode: SourceCode, node: Node): string {
  return truncate(sourceCode.getText(node).replace(/\s+/g, ' '))
}


/**
 * Shared settings for every affirm rule, in the flat config's `settings.affirm`:
 *
 * - `sources`: module specifiers that export `affirm` (default `['affirm']`). Add your own re-export.
 * - `guards`: a regular expression (as a string) that every function returning `affirm(…)` must match,
 *   and that only such functions may match. With it, negated calls to imported guards are caught too.
 * - `guardModules`: import prefixes that are your own code, for path aliases such as `'@/'`.
 *   Guards are recognised when defined in the file, imported from a relative path, or imported from
 *   one of these prefixes; anything imported from a package (a third-party `isValid…`) is not a guard.
 */
export interface AffirmSettings {
  sources?: string[]
  guards?: string
  guardModules?: string[]
}

function settingsOf(context: Rule.RuleContext): AffirmSettings {
  const settings = (context.settings as { affirm?: unknown }).affirm
  if (settings === undefined) return {}
  if (typeof settings !== 'object' || settings === null) throw new Error('affirm: `settings.affirm` must be an object')
  return settings as AffirmSettings
}

/** `sources` from the rule's own option (if given), else `settings.affirm.sources`, else `['affirm']`. */
export function sourcesOf(context: Rule.RuleContext, option?: string[]): ReadonlySet<string> {
  const sources = option ?? settingsOf(context).sources ?? ['affirm']
  if (!Array.isArray(sources) || sources.some((s) => typeof s !== 'string')) {
    throw new Error('affirm: `settings.affirm.sources` must be an array of module specifiers')
  }
  return new Set(sources)
}

/** `settings.affirm.guards` compiled, or `undefined` when no guard pattern is configured. */
export function guardPatternOf(context: Rule.RuleContext): RegExp | undefined {
  const pattern = settingsOf(context).guards
  if (pattern === undefined) return undefined
  if (typeof pattern !== 'string' || pattern === '') {
    throw new Error('affirm: `settings.affirm.guards` must be a non-empty regular expression string, e.g. "^isValid"')
  }
  try {
    return new RegExp(pattern, 'u')
  } catch (error) {
    throw new Error(`affirm: \`settings.affirm.guards\` is not a valid regular expression: ${(error as Error).message}`)
  }
}

/** `guardModules` as a list of prefixes (default none: only relative imports count as project code). */
export function guardModulesOf(context: Rule.RuleContext): readonly string[] {
  const modules = settingsOf(context).guardModules ?? []
  if (!Array.isArray(modules) || modules.some((m) => typeof m !== 'string' || m === '')) {
    throw new Error("affirm: `settings.affirm.guardModules` must be an array of import prefixes, e.g. ['@/']")
  }
  return modules
}

/** The module an imported variable comes from, or `undefined` when it isn't an import. */
export function importSourceOf(variable: Scope.Variable | undefined): string | undefined {
  const def = variable?.defs[0]
  if (def?.type !== 'ImportBinding') return undefined
  const source = (def.parent as { source?: { value?: unknown } } | null)?.source?.value
  return typeof source === 'string' ? source : undefined
}

/**
 * Whether a call that matches the guard pattern can be one of the project's guards: defined in this
 * file, imported from a relative path or a `guardModules` prefix, or a method on a local value.
 * Calls into packages (`import validator from 'validator'; validator.isValidX()`) are not.
 */
export function isProjectCall(call: Node, sourceCode: SourceCode, guardModules: readonly string[]): boolean {
  if (call.type !== 'CallExpression') return false
  const callee = call.callee as Node
  const root = callee.type === 'Identifier' ? callee : callee.type === 'MemberExpression' && callee.object.type === 'Identifier' ? callee.object : undefined
  if (root === undefined) return true // `this.isValidX()`, `make().isValidX()`: project code we can't trace
  const variable = findVariable(sourceCode.getScope(call), root.name)
  if (variable === undefined) return callee.type !== 'Identifier' // an undeclared global function is not a project guard
  const source = importSourceOf(variable)
  if (source === undefined) return true // defined in this file
  return source.startsWith('.') || guardModules.some((prefix) => source.startsWith(prefix))
}

/** The name a function is bound to, and the node to report on: declarations, variables, object and class members. */
export function functionName(fn: Node): { name: string; node: Node } | undefined {
  if (fn.type === 'FunctionDeclaration') return fn.id ? { name: fn.id.name, node: fn.id as Node } : undefined
  const holder = outermost(fn).parent
  if (holder?.type === 'VariableDeclarator' && holder.init === outermost(fn) && holder.id.type === 'Identifier') {
    return { name: holder.id.name, node: holder.id as Node }
  }
  const member = holder as (Node & { key?: Node; computed?: boolean; value?: unknown }) | null
  const isMember = member?.type === 'Property' || member?.type === 'MethodDefinition' || (member?.type as string) === 'PropertyDefinition'
  if (isMember && member!.value === outermost(fn) && !member!.computed && member!.key?.type === 'Identifier') {
    return { name: member!.key.name, node: member!.key }
  }
  return undefined
}

/** The name a call goes through: `isValidOrder(x)` or `guards.isValidOrder(x)`. */
export function calleeName(call: Node): string | undefined {
  if (call.type !== 'CallExpression') return undefined
  const callee = call.callee as Node
  if (callee.type === 'Identifier') return callee.name
  if (callee.type === 'MemberExpression' && !callee.computed && callee.property.type === 'Identifier') return callee.property.name
  return undefined
}

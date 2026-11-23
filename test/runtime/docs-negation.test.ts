// Design D8: the usage docs must not teach negated affirm() calls. A negated call may only appear
// on a line marked `✗` (the "what is banned" examples).
import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'

const DOCS = ['AGENTS.md', 'docs/client-usage.md'] // vitest runs from the project root

const NEGATED = [
  /!\s*\(*\s*affirm\s*(\?\.)?\(/, // !affirm(  !(affirm(  !affirm?.(
  /affirm\(.*\)\s*(===?\s*false|!==?\s*true)\b/, // affirm(…) === false, affirm(…) !== true
  /\b(false\s*===?|true\s*!==?)\s*affirm\(/, // false === affirm(…)
]

/** Lines inside fenced ts/js code blocks, with their line numbers. */
function codeLines(markdown: string): { line: number; text: string }[] {
  const out: { line: number; text: string }[] = []
  let inCode = false
  markdown.split('\n').forEach((text, i) => {
    if (/^\s*```/.test(text)) {
      inCode = !inCode && /^\s*```(ts|js|tsx|jsx)\b/.test(text)
      return
    }
    if (inCode) out.push({ line: i + 1, text })
  })
  return out
}

describe.each(DOCS)('%s', (file) => {
  test('has no negated affirm() outside ✗ examples', () => {
    const offending = codeLines(readFileSync(file, 'utf8'))
      .filter(({ text }) => NEGATED.some((re) => re.test(text)) && !text.includes('✗'))
      .map(({ line, text }) => `${file}:${line}: ${text.trim()}`)
    expect(offending).toEqual([])
  })
})

test('the patterns catch the banned forms', () => {
  const banned = ['if (!affirm(x, p)) return', 'if (!(affirm(x, p))) {}', 'affirm(x, p) === false', 'true !== affirm(x, p)']
  const allowed = ['if (!report.ok) {}', 'affirm.explain(x, p)', 'affirm(x, p) === true', "affirm(x, { not: { isNull: true } })"]
  for (const text of banned) expect(NEGATED.some((re) => re.test(text)), text).toBe(true)
  for (const text of allowed) expect(NEGATED.some((re) => re.test(text)), text).toBe(false)
})

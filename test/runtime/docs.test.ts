// Design §11: the docs are part of the API. Every key in AffirmParams has JSDoc with a one-line
// meaning, the pass condition and an @example. Agents learn the API from hover docs.
import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'
import { checks } from '../../src/core/registry'

const TYPES_DIR = 'src/types' // vitest runs from the project root

interface KeyDoc {
  key: string
  file: string
  doc: string
}

/** Every `key?:` property inside an `export interface …Params` block, with the JSDoc right above it. */
function scanParamDocs(): KeyDoc[] {
  const docs: KeyDoc[] = []
  for (const file of readdirSync(TYPES_DIR).filter((f) => f.endsWith('.ts'))) {
    const source = readFileSync(`${TYPES_DIR}/${file}`, 'utf8')
    for (const block of source.matchAll(/^export interface \w+Params\b[^{]*\{\n([\s\S]*?)^\}/gm)) {
      for (const match of block[1]!.matchAll(/(?:\/\*\*([\s\S]*?)\*\/\s*)?^ {2}(\w+)\?:/gm)) {
        docs.push({ key: match[2]!, file, doc: match[1] ?? '' })
      }
    }
  }
  return docs
}

const docs = scanParamDocs()
const docByKey = new Map(docs.map((d) => [d.key, d]))

describe('documentation contract (design §11)', () => {
  test('the scan finds exactly the registry keys', () => {
    expect(docs.map((d) => d.key).sort()).toEqual(Object.keys(checks).sort())
  })

  describe.each(Object.keys(checks).sort())('%s', (key) => {
    const entry = docByKey.get(key)

    test('has JSDoc with a one-line meaning', () => {
      expect(entry?.doc.trim(), `${key} has no JSDoc`).toBeTruthy()
      const firstLine = entry!.doc
        .split('\n')
        .map((l) => l.replace(/^\s*\*\s?/, '').trim())
        .find((l) => l !== '')
      expect(firstLine?.length).toBeGreaterThan(10)
    })

    test('states the pass condition', () => {
      expect(entry!.doc).toMatch(/Passes when/)
    })

    test('has an @example that uses the key', () => {
      const example = entry!.doc.split('@example')[1]
      expect(example, `${key} has no @example`).toBeDefined()
      expect(example).toMatch(new RegExp(`\\b${key}\\b`))
    })
  })
})

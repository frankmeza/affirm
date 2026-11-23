// pnpm installs `file:` dependencies by hard-linking their files at install time. An in-place edit
// reaches node_modules, but most editors save by writing a new file and renaming it, which breaks the
// link and leaves node_modules stale until the next `pnpm install`. Fail loudly instead.
import { readdirSync, readFileSync } from 'node:fs'
import { expect, test } from 'vitest'

const FIXTURES = [{ source: 'test/fixtures/ts-parser', installed: 'node_modules/affirm-test-ts-parser' }]

test.each(FIXTURES)('$source is installed and up to date', ({ source, installed }) => {
  for (const file of readdirSync(source)) {
    if (file === 'node_modules') continue
    const stale = readFileSync(`${source}/${file}`, 'utf8') !== readFileSync(`${installed}/${file}`, 'utf8')
    expect(stale, `${source}/${file} changed since the last install: run \`pnpm install\``).toBe(false)
  }
})

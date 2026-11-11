// M0 toolchain smoke test: proves type-level tests run on the installed TypeScript.
// M2 (design §6.3) depends on this working. Delete once real type tests land.
import { expectTypeOf, test } from 'vitest'

declare const refined: unique symbol
type Refined = { readonly [refined]?: never }

function isLongString(v: unknown): v is string & Refined {
  return typeof v === 'string' && v.length >= 3
}

test('type tests run and branded predicates narrow one-sided', () => {
  const x = null as unknown as string | number
  if (isLongString(x)) {
    expectTypeOf(x).toExtend<string>()
  } else {
    // else branch must keep `string` (a short string lands here)
    expectTypeOf(x).toEqualTypeOf<string | number>()
  }
})

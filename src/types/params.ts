import type { ArrayParams } from './arrays'
import type { EqualityParams } from './equality'
import type { NullishParams } from './nullish'
import type { NumberParams } from './numbers'
import type { ObjectParams } from './objects'
import type { RuntimeTypeParams } from './runtime-type'
import type { SizeParams } from './size'
import type { StringParams } from './strings'

/**
 * Every check `affirm` understands. Keys combine with AND; an omitted or `undefined` key is skipped.
 * The composition group (not, anyOf, satisfies) and shape/everyItem/someItem are added in M4.
 */
export interface AffirmParams
  extends EqualityParams,
    NullishParams,
    RuntimeTypeParams,
    SizeParams,
    NumberParams,
    StringParams,
    ObjectParams,
    ArrayParams {}

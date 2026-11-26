import type { ArrayParams } from './arrays.js'
import type { CompositionParams } from './composition.js'
import type { EqualityParams } from './equality.js'
import type { NullishParams } from './nullish.js'
import type { NumberParams } from './numbers.js'
import type { ObjectParams } from './objects.js'
import type { RuntimeTypeParams } from './runtime-type.js'
import type { SizeParams } from './size.js'
import type { StringParams } from './strings.js'

/**
 * Every check `affirm` understands. Keys combine with AND; an omitted or `undefined` key is skipped.
 */
export interface AffirmParams
  extends EqualityParams,
    NullishParams,
    RuntimeTypeParams,
    SizeParams,
    NumberParams,
    StringParams,
    ObjectParams,
    ArrayParams,
    CompositionParams {}

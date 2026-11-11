import type { EqualityParams } from './equality'
import type { NullishParams } from './nullish'
import type { RuntimeTypeParams } from './runtime-type'

/**
 * Every check `affirm` understands. Keys combine with AND; an omitted or `undefined` key is skipped.
 * Groups are added here as they land (M3: size, numbers, strings, objects, arrays; M4: composition).
 */
export interface AffirmParams extends EqualityParams, NullishParams, RuntimeTypeParams {}

/**
 * Describes a value by type and size only, never by content (design §8, D5).
 * Used for `AffirmFailure.received`.
 */
export function describe(value: unknown): string {
  if (value === null) return 'null'
  switch (typeof value) {
    case 'undefined':
      return 'undefined'
    case 'string':
      return `string(len ${value.length})`
    case 'number':
      return Number.isNaN(value) ? 'number(NaN)' : 'number'
    case 'boolean':
    case 'bigint':
    case 'symbol':
      return typeof value
    case 'function':
      return 'function'
  }
  if (Array.isArray(value)) return `array(len ${value.length})`
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? 'Date(invalid)' : 'Date'
  if (value instanceof Map) return `Map(size ${value.size})`
  if (value instanceof Set) return `Set(size ${value.size})`
  if (value instanceof RegExp) return 'RegExp'
  const keys = Object.keys(value as object).length
  const proto: unknown = Object.getPrototypeOf(value)
  const name = proto === null || proto === Object.prototype ? 'object' : constructorName(value as object)
  return `${name}{${keys} ${keys === 1 ? 'key' : 'keys'}}`
}

function constructorName(value: object): string {
  const ctor: unknown = (value as { constructor?: unknown }).constructor
  return typeof ctor === 'function' && ctor.name !== '' ? ctor.name : 'object'
}

const MAX_STRING_PARAM = 32
const MAX_LIST_ITEMS = 5

/**
 * Formats a *param* (authored in code, not data) for `expected`.
 * Short strings and primitives are shown literally; anything else is described.
 */
export function formatParam(param: unknown): string {
  switch (typeof param) {
    case 'string':
      return param.length <= MAX_STRING_PARAM ? JSON.stringify(param) : `string(len ${param.length})`
    case 'number':
      return Object.is(param, -0) ? '-0' : String(param)
    case 'bigint':
      return `${param}n`
    case 'boolean':
    case 'undefined':
      return String(param)
    case 'symbol':
      return param.toString()
    case 'function':
      return param.name === '' ? 'function' : param.name
  }
  return param === null ? 'null' : describe(param)
}

export function formatList(list: readonly unknown[]): string {
  const shown = list.slice(0, MAX_LIST_ITEMS).map(formatParam)
  const more = list.length - shown.length
  return `[${shown.join(', ')}${more > 0 ? `, … (+${more})` : ''}]`
}

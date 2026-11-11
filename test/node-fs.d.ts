// Minimal typings for the two node:fs functions the docs test uses. Avoids adding @types/node,
// which would make Node globals (process, Buffer, …) type-check in src/ as well.
declare module 'node:fs' {
  export function readFileSync(path: string, encoding: 'utf8'): string
  export function readdirSync(path: string): string[]
}

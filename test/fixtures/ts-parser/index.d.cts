// Typed loosely on purpose: tests cast it to ESLint's `Linter.Parser`.
declare const parser: { parseForESLint(code: string, options?: unknown): unknown }
export = parser

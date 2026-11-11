import { describe, expect, test } from "vitest"
import { affirm } from "../../src"

describe("isType: tags", () => {
  test("primitive tags", () => {
    expect(affirm("a", { isType: "string" })).toBe(true)
    expect(affirm(1, { isType: "number" })).toBe(true)
    expect(affirm(Number.NaN, { isType: "number" })).toBe(true)
    expect(affirm(true, { isType: "boolean" })).toBe(true)
    expect(affirm(1n, { isType: "bigint" })).toBe(true)
    expect(affirm(Symbol("s"), { isType: "symbol" })).toBe(true)
    expect(affirm(() => 1, { isType: "function" })).toBe(true)
    expect(affirm("1", { isType: "number" })).toBe(false)
  })

  test("'object' excludes null, includes arrays", () => {
    expect(affirm({}, { isType: "object" })).toBe(true)
    expect(affirm([], { isType: "object" })).toBe(true)
    expect(affirm(null, { isType: "object" })).toBe(false)
    expect(affirm(() => 1, { isType: "object" })).toBe(false)
  })

  test("'null' / 'undefined' / unknown tags throw with guidance", () => {
    expect(() => affirm(null, { isType: "null" as never })).toThrow(
      /use `isNull: true`/,
    )
    expect(() => affirm(undefined, { isType: "undefined" as never })).toThrow(
      /use `isUndefined: true`/,
    )
    expect(() => affirm("a", { isType: "str" as never })).toThrow(TypeError)
  })
})

describe("isType: guards", () => {
  const isUser = (v: unknown): v is { id: string } =>
    typeof v === "object" &&
    v !== null &&
    typeof (v as { id?: unknown }).id === "string"

  test("guard result decides", () => {
    expect(affirm({ id: "u1" }, { isType: isUser })).toBe(true)
    expect(affirm({ id: 1 }, { isType: isUser })).toBe(false)
  })

  test("guard name appears in expected", () => {
    expect(affirm.explain({}, { isType: isUser }).failures[0]?.expected).toBe(
      "isUser(value) to return true",
    )
  })

  test('classes and built-in constructors throw "use isInstanceOf"', () => {
    class User {}
    expect(() => affirm({}, { isType: User as never })).toThrow(
      /use `isInstanceOf: User`/,
    )
    expect(() => affirm({}, { isType: Date as never })).toThrow(
      /use `isInstanceOf: Date`/,
    )
  })

  test("Standard Schema is rejected until M5", () => {
    const schema = {
      "~standard": { version: 1, vendor: "x", validate: () => ({ value: 1 }) },
    }
    expect(() => affirm(1, { isType: schema as never })).toThrow(
      /Standard Schema/,
    )
  })
})

describe("isArray / isPlainObject / isFunction", () => {
  test("isArray", () => {
    expect(affirm([], { isArray: true })).toBe(true)
    expect(affirm({ length: 0 }, { isArray: true })).toBe(false)
    expect(affirm("abc", { isArray: false })).toBe(true)
  })

  test("isPlainObject: Object.prototype or null prototype only", () => {
    expect(affirm({}, { isPlainObject: true })).toBe(true)
    expect(affirm(Object.create(null), { isPlainObject: true })).toBe(true)
    expect(affirm([], { isPlainObject: true })).toBe(false)
    expect(affirm(new Date(), { isPlainObject: true })).toBe(false)
    expect(affirm(new (class {})(), { isPlainObject: true })).toBe(false)
    expect(affirm(null, { isPlainObject: false })).toBe(true)
  })

  test("isFunction", () => {
    expect(affirm(() => 1, { isFunction: true })).toBe(true)
    // Classes are functions (`typeof class {} === 'function'`), so they pass. Deliberate: matches
    // plain `typeof`. Caveat for JSDoc (M6): calling a class without `new` throws.
    expect(affirm(class {}, { isFunction: true })).toBe(true)
    expect(affirm({}, { isFunction: false })).toBe(true)
  })
})

describe("isInstanceOf", () => {
  test("instanceof semantics", () => {
    class A {}
    class B extends A {}
    expect(affirm(new B(), { isInstanceOf: A })).toBe(true)
    expect(affirm(new A(), { isInstanceOf: B })).toBe(false)
    expect(affirm(new Map(), { isInstanceOf: Map })).toBe(true)
    expect(affirm({}, { isInstanceOf: Map })).toBe(false)
  })

  test("non-constructor param throws", () => {
    expect(() => affirm({}, { isInstanceOf: (() => {}) as never })).toThrow(
      TypeError,
    )
    expect(() => affirm({}, { isInstanceOf: "Map" as never })).toThrow(
      TypeError,
    )
  })
})

describe("kind-gated boolean keys (D7: wrong kind fails both polarities)", () => {
  test("isValidDate", () => {
    expect(affirm(new Date(0), { isValidDate: true })).toBe(true)
    expect(affirm(new Date("nope"), { isValidDate: true })).toBe(false)
    expect(affirm(new Date("nope"), { isValidDate: false })).toBe(true)
    expect(affirm("2024-01-01", { isValidDate: true })).toBe(false)
    expect(affirm("2024-01-01", { isValidDate: false })).toBe(false)
  })

  test("isInteger", () => {
    expect(affirm(3, { isInteger: true })).toBe(true)
    expect(affirm(3.5, { isInteger: true })).toBe(false)
    expect(affirm(3.5, { isInteger: false })).toBe(true)
    expect(affirm("3", { isInteger: true })).toBe(false)
    expect(affirm("3", { isInteger: false })).toBe(false)
  })

  test("isFiniteNumber", () => {
    expect(affirm(1, { isFiniteNumber: true })).toBe(true)
    expect(affirm(Infinity, { isFiniteNumber: true })).toBe(false)
    expect(affirm(Number.NaN, { isFiniteNumber: false })).toBe(true)
    expect(affirm(null, { isFiniteNumber: false })).toBe(false)
  })

  test("isNaN", () => {
    expect(affirm(Number.NaN, { isNaN: true })).toBe(true)
    expect(affirm(1, { isNaN: false })).toBe(true)
    expect(affirm("abc", { isNaN: true })).toBe(false)
    expect(affirm("abc", { isNaN: false })).toBe(false)
  })

  test("gate failure reports the kind, not the check", () => {
    expect(affirm.explain("3", { isInteger: false }).failures[0]).toMatchObject(
      {
        expected: "a number",
        reason: "expected a number, received string(len 1)",
      },
    )
  })
})

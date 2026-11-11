// Vendored Standard Schema V1 types (https://standardschema.dev). The spec intends these to be
// copied rather than depended on (design §10). Type-only; no runtime code from the spec.

/** The Standard Schema interface. */
export interface StandardSchemaV1<Input = unknown, Output = Input> {
  /** The Standard Schema properties. */
  readonly '~standard': StandardSchemaV1.Props<Input, Output>
}

export declare namespace StandardSchemaV1 {
  /** The Standard Schema properties interface. */
  export interface Props<Input = unknown, Output = Input> {
    /** The version number of the standard. */
    readonly version: 1
    /** The vendor name of the schema library. */
    readonly vendor: string
    /** Validates unknown input values. */
    readonly validate: (value: unknown) => Result<Output> | Promise<Result<Output>>
    /** Inferred types associated with the schema. */
    readonly types?: Types<Input, Output> | undefined
  }

  /** The result interface of the validate function. */
  export type Result<Output> = SuccessResult<Output> | FailureResult

  /** The result interface if validation succeeds. */
  export interface SuccessResult<Output> {
    /** The typed output value. */
    readonly value: Output
    /** The non-existent issues. */
    readonly issues?: undefined
  }

  /** The result interface if validation fails. */
  export interface FailureResult {
    /** The issues of failed validation. */
    readonly issues: ReadonlyArray<Issue>
  }

  /** The issue interface of the failure output. */
  export interface Issue {
    /** The error message of the issue. */
    readonly message: string
    /** The path of the issue, if any. */
    readonly path?: ReadonlyArray<PropertyKey | PathSegment> | undefined
  }

  /** The path segment interface of the issue. */
  export interface PathSegment {
    /** The key representing a path segment. */
    readonly key: PropertyKey
  }

  /** The Standard Schema types interface. */
  export interface Types<Input = unknown, Output = Input> {
    /** The input type of the schema. */
    readonly input: Input
    /** The output type of the schema. */
    readonly output: Output
  }

  /** Infers the input type of a Standard Schema. */
  export type InferInput<Schema extends StandardSchemaV1> = NonNullable<Schema['~standard']['types']>['input']

  /** Infers the output type of a Standard Schema. */
  export type InferOutput<Schema extends StandardSchemaV1> = NonNullable<Schema['~standard']['types']>['output']
}

// --- affirm's runtime helpers ---------------------------------------------------------------

/**
 * Detects a Standard Schema via its `'~standard'` property. Schemas may be objects (Zod, Valibot)
 * or callable functions (ArkType), so both are accepted.
 */
export function isStandardSchema(value: unknown): value is StandardSchemaV1 {
  if ((typeof value !== 'object' && typeof value !== 'function') || value === null) return false
  const props: unknown = (value as { '~standard'?: unknown })['~standard']
  return (
    typeof props === 'object' &&
    props !== null &&
    (props as { version?: unknown }).version === 1 &&
    typeof (props as { validate?: unknown }).validate === 'function'
  )
}

/** Runs a schema synchronously. Throws `TypeError` for async schemas (design §4 rule 6, §10). */
export function validateSync(schema: StandardSchemaV1, value: unknown): StandardSchemaV1.Result<unknown> {
  const result = schema['~standard'].validate(value)
  if (typeof (result as { then?: unknown }).then === 'function') {
    // Avoid an unhandled rejection from the promise we're discarding.
    ;(result as Promise<unknown>).then(undefined, () => {})
    throw new TypeError(
      `affirm: async schemas are not supported by affirm; validate them before calling affirm (vendor: ${schema['~standard'].vendor})`,
    )
  }
  return result as StandardSchemaV1.Result<unknown>
}

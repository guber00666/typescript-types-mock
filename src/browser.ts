/**
 * typescript-types-mock — Browser entry point
 *
 * This module is safe to use in browser environments.
 * It does NOT depend on ts-morph, fs, path, or any Node.js APIs.
 *
 * Usage:
 *   1. At build time, generate a schema: `npx typescript-types-mock generate ./types.ts -o ./types.schema.json`
 *   2. At runtime, import the schema and create mocks:
 *
 * ```typescript
 * import { createMockContext } from "typescript-types-mock/browser";
 * import schema from "./types.schema.json";
 *
 * const ctx = createMockContext(schema);
 * const user = ctx.mock("User");
 * ```
 */

// Browser-safe resolver
export { BrowserTypeResolver } from "./core/browser-type-resolver.js";
export type { TypeSchema } from "./core/browser-type-resolver.js";

// Core classes (browser-safe)
export { MockGenerator } from "./core/mock-generator.js";
export { MockContextBase } from "./core/mock-context-base.js";

// Types
export type { ITypeResolver } from "./core/type-resolver-interface.js";
export type {
  MockOptions,
  TypeNode,
  TypeKind,
  PropertyNode,
  ResolvedTypes,
} from "./types/index.js";

// Playwright helpers (browser-safe)
export {
  createRouteResponse,
  createApiResponse,
  createPaginatedResponse,
} from "./helpers/playwright.js";
export type {
  RouteResponseOptions,
  ApiResponseOptions,
} from "./helpers/playwright.js";

// Utilities (browser-safe)
export { RandomGenerator } from "./utils/random.js";

import { BrowserTypeResolver } from "./core/browser-type-resolver.js";
import type { TypeSchema } from "./core/browser-type-resolver.js";
import { MockContextBase } from "./core/mock-context-base.js";
import { MockGenerator } from "./core/mock-generator.js";
import type { MockOptions, ResolvedTypes } from "./types/index.js";

/**
 * Create a caching mock context from a pre-built type schema (JSON).
 *
 * Browser-safe alternative to `createMockContext` from the main entry.
 * Parses the schema once and caches it for fast repeated calls.
 *
 * @param schema - A schema object (imported from .schema.json)
 * @param defaultOptions - Default options applied to all mock generation calls
 * @returns A MockContextBase instance
 *
 * @example
 * ```typescript
 * import schema from "./types.schema.json";
 * import { createMockContext } from "typescript-types-mock/browser";
 *
 * const ctx = createMockContext(schema, { seed: 42 });
 * const user = ctx.mock("User");
 * const admin = ctx.mock("Admin", { overrides: { role: "admin" } });
 * ```
 */
export function createMockContext(
  schema: TypeSchema,
  defaultOptions: Omit<MockOptions, "filePath"> = {}
): MockContextBase {
  const resolver = new BrowserTypeResolver(schema);
  return new MockContextBase(resolver, defaultOptions);
}

/**
 * Create a mock object from a pre-built type schema (JSON).
 *
 * Browser-safe alternative to `createMockFromFile`.
 * Use the CLI tool to generate the schema at build time:
 * ```bash
 * npx typescript-types-mock generate ./types.ts -o ./types.schema.json
 * ```
 *
 * @param schema - A schema object (imported from .schema.json)
 * @param typeName - Name of the type to mock
 * @param options - Mock generation options
 * @returns A mock object matching the type definition
 *
 * @example
 * ```typescript
 * import schema from "./types.schema.json";
 * import { createMockFromSchema } from "typescript-types-mock/browser";
 *
 * const user = createMockFromSchema(schema, "User");
 * ```
 */
export function createMockFromSchema(
  schema: TypeSchema,
  typeName: string,
  options: Omit<MockOptions, "filePath"> = {},
): unknown {
  const resolver = new BrowserTypeResolver(schema);
  const resolvedTypes = resolver.resolveAllTypes();

  if (!resolvedTypes[typeName]) {
    throw new Error(
      `Type "${typeName}" not found in schema. ` +
        `Available types: ${Object.keys(resolvedTypes).join(", ")}`,
    );
  }

  const generator = new MockGenerator(resolvedTypes, options);
  return generator.generate(typeName);
}

/**
 * Create multiple mock objects from a pre-built type schema.
 *
 * @param schema - A schema object (imported from .schema.json)
 * @param typeName - Name of the type to mock
 * @param count - Number of mock objects to generate
 * @param options - Mock generation options
 * @returns An array of mock objects
 */
export function createManyMocksFromSchema(
  schema: TypeSchema,
  typeName: string,
  count: number,
  options: Omit<MockOptions, "filePath"> = {},
): unknown[] {
  const resolver = new BrowserTypeResolver(schema);
  const resolvedTypes = resolver.resolveAllTypes();

  if (!resolvedTypes[typeName]) {
    throw new Error(
      `Type "${typeName}" not found in schema. ` +
        `Available types: ${Object.keys(resolvedTypes).join(", ")}`,
    );
  }

  const generator = new MockGenerator(resolvedTypes, options);
  return Array.from({ length: count }, () => generator.generate(typeName));
}

/**
 * List all available type names in a pre-built schema.
 *
 * @param schema - A schema object (imported from .schema.json)
 * @returns Array of type names found in the schema
 */
export function listTypesFromSchema(schema: TypeSchema): string[] {
  return Object.keys(schema);
}

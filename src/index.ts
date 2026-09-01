/**
 * typescript-types-mock
 *
 * Generate mock objects from TypeScript type definitions at runtime.
 * Uses ts-morph to parse .ts files and create realistic mock data.
 */

export { TypeResolver } from "./core/type-resolver.js";
export { MockGenerator } from "./core/mock-generator.js";
export type {
  MockOptions,
  TypeNode,
  TypeKind,
  PropertyNode,
  ResolvedTypes,
} from "./types/index.js";

import { TypeResolver } from "./core/type-resolver.js";
import { MockGenerator } from "./core/mock-generator.js";
import type { MockOptions } from "./types/index.js";

/**
 * Create a mock object from a TypeScript type definition in a file.
 *
 * @param filePath - Path to the .ts file containing the type definition
 * @param typeName - Name of the type/interface/enum/class to mock
 * @param options - Configuration options for mock generation
 * @returns A mock object matching the type definition
 *
 * @example
 * ```typescript
 * // Given types.ts:
 * // interface User { name: string; age: number; email: string; }
 *
 * const user = createMockFromFile("./types.ts", "User");
 * // => { name: "Lorem ipsum", age: 42, email: "Hello World" }
 * ```
 */
export function createMockFromFile(
  filePath: string,
  typeName: string,
  options: Omit<MockOptions, "filePath"> = {}
): unknown {
  const resolver = new TypeResolver(filePath);
  const resolvedTypes = resolver.resolveAllTypes();

  if (!resolvedTypes[typeName]) {
    throw new Error(
      `Type "${typeName}" not found in file "${filePath}". ` +
        `Available types: ${Object.keys(resolvedTypes).join(", ")}`
    );
  }

  const generator = new MockGenerator(resolvedTypes, {
    ...options,
    filePath,
  });

  return generator.generate(typeName);
}

/**
 * Create multiple mock objects from a TypeScript type definition.
 *
 * @param filePath - Path to the .ts file containing the type definition
 * @param typeName - Name of the type/interface/enum/class to mock
 * @param count - Number of mock objects to generate
 * @param options - Configuration options for mock generation
 * @returns An array of mock objects
 *
 * @example
 * ```typescript
 * const users = createManyMocks("./types.ts", "User", 5);
 * // => [{ name: "Lorem ipsum", ... }, { name: "Foo Bar", ... }, ...]
 * ```
 */
export function createManyMocks(
  filePath: string,
  typeName: string,
  count: number,
  options: Omit<MockOptions, "filePath"> = {}
): unknown[] {
  const resolver = new TypeResolver(filePath);
  const resolvedTypes = resolver.resolveAllTypes();

  if (!resolvedTypes[typeName]) {
    throw new Error(
      `Type "${typeName}" not found in file "${filePath}". ` +
        `Available types: ${Object.keys(resolvedTypes).join(", ")}`
    );
  }

  const generator = new MockGenerator(resolvedTypes, {
    ...options,
    filePath,
  });

  return Array.from({ length: count }, () => generator.generate(typeName));
}

/**
 * List all available type names in a TypeScript file.
 *
 * @param filePath - Path to the .ts file to analyze
 * @returns Array of type names found in the file
 *
 * @example
 * ```typescript
 * const types = listTypes("./types.ts");
 * // => ["User", "Admin", "UserRole", "Post"]
 * ```
 */
export function listTypes(filePath: string): string[] {
  const resolver = new TypeResolver(filePath);
  const resolvedTypes = resolver.resolveAllTypes();
  return Object.keys(resolvedTypes);
}

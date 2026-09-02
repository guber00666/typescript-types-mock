/**
 * MockContext — a caching wrapper around TypeResolver and MockGenerator.
 *
 * Instead of re-parsing the TypeScript file on every call (expensive ts-morph
 * initialization), MockContext parses the file once and reuses the resolved
 * type information across multiple mock-generation calls.
 *
 * @example
 * ```typescript
 * const ctx = createMockContext("./types.ts");
 * const user = ctx.createMock("User");
 * const admin = ctx.createMock("Admin");
 * const users = ctx.createMany("User", 10);
 * const types = ctx.listTypes();
 * ```
 */

import { TypeResolver } from "./type-resolver.js";
import { MockGenerator } from "./mock-generator.js";
import type { MockOptions, ResolvedTypes } from "../types/index.js";

export class MockContext {
  private resolver: TypeResolver;
  private resolvedTypes: ResolvedTypes;
  private defaultOptions: Omit<MockOptions, "filePath">;
  private lazyMode: boolean;

  constructor(
    filePath: string,
    defaultOptions: Omit<MockOptions, "filePath"> & { lazy?: boolean } = {}
  ) {
    const { lazy = false, ...opts } = defaultOptions;
    this.resolver = new TypeResolver(filePath);
    this.lazyMode = lazy;
    // In lazy mode, defer type resolution until first use
    this.resolvedTypes = lazy ? {} : this.resolver.resolveAllTypes();
    this.defaultOptions = opts;
  }

  /**
   * The resolved absolute file path.
   */
  get filePath(): string {
    return this.resolver.filePath;
  }

  /**
   * Ensure a type is resolved (lazy-loads it if not yet cached).
   */
  private ensureTypeResolved(typeName: string): void {
    if (this.resolvedTypes[typeName]) return;

    if (this.lazyMode) {
      // Try to resolve just this one type
      const typeNode = this.resolver.resolveType(typeName);
      if (typeNode) {
        this.resolvedTypes[typeName] = typeNode;
        return;
      }
    }

    // Fallback: resolve all types (if not done yet)
    if (Object.keys(this.resolvedTypes).length === 0) {
      this.resolvedTypes = this.resolver.resolveAllTypes();
    }
  }

  /**
   * Create a single mock object for the given type name.
   */
  createMock(typeName: string, options: Omit<MockOptions, "filePath"> = {}): unknown {
    this.ensureTypeResolved(typeName);
    if (!this.resolvedTypes[typeName]) {
      throw new Error(
        `Type "${typeName}" not found in file "${this.filePath}". ` +
          `Available types: ${Object.keys(this.resolvedTypes).join(", ")}`
      );
    }

    const generator = new MockGenerator(this.resolvedTypes, {
      ...this.defaultOptions,
      ...options,
      filePath: this.filePath,
    });

    return generator.generate(typeName);
  }

  /**
   * Create multiple mock objects for the given type name.
   */
  createMany(
    typeName: string,
    count: number,
    options: Omit<MockOptions, "filePath"> = {}
  ): unknown[] {
    this.ensureTypeResolved(typeName);
    if (!this.resolvedTypes[typeName]) {
      throw new Error(
        `Type "${typeName}" not found in file "${this.filePath}". ` +
          `Available types: ${Object.keys(this.resolvedTypes).join(", ")}`
      );
    }

    const generator = new MockGenerator(this.resolvedTypes, {
      ...this.defaultOptions,
      ...options,
      filePath: this.filePath,
    });

    return Array.from({ length: count }, () => generator.generate(typeName));
  }

  /**
   * Shorthand for `createMock` — create a single mock object.
   *
   * @example
   * ```typescript
   * const user = ctx.mock("User");
   * const admin = ctx.mock("Admin", { overrides: { role: "admin" } });
   * ```
   */
  mock(typeName: string, options: Omit<MockOptions, "filePath"> = {}): unknown {
    return this.createMock(typeName, options);
  }

  /**
   * Shorthand for `createMany` — create multiple mock objects.
   *
   * @example
   * ```typescript
   * const users = ctx.many("User", 10);
   * ```
   */
  many(typeName: string, count: number, options: Omit<MockOptions, "filePath"> = {}): unknown[] {
    return this.createMany(typeName, count, options);
  }

  /**
   * List all available type names in the source file.
   * In lazy mode, triggers full type resolution.
   */
  listTypes(): string[] {
    if (this.lazyMode && Object.keys(this.resolvedTypes).length === 0) {
      this.resolvedTypes = this.resolver.resolveAllTypes();
    }
    return Object.keys(this.resolvedTypes);
  }

  /**
   * Get the resolved types map (for advanced usage).
   */
  getResolvedTypes(): ResolvedTypes {
    return this.resolvedTypes;
  }
}

/**
 * Create a caching mock context for a TypeScript file.
 *
 * The context parses the file once and caches the result,
 * making subsequent calls much faster than `createMockFromFile`.
 *
 * @param filePath - Path to the .ts file containing type definitions
 * @param defaultOptions - Default options applied to all mock generation calls
 * @returns A MockContext instance
 *
 * @example
 * ```typescript
 * const ctx = createMockContext("./types.ts", { seed: 42 });
 *
 * // All calls reuse the same parsed types — fast!
 * const user = ctx.createMock("User");
 * const admin = ctx.createMock("Admin", { overrides: { role: "admin" } });
 * const users = ctx.createMany("User", 10);
 * ```
 */
export function createMockContext(
  filePath: string,
  defaultOptions: Omit<MockOptions, "filePath"> = {}
): MockContext {
  return new MockContext(filePath, defaultOptions);
}

/**
 * MockContext — a caching wrapper around TypeResolver and MockGenerator.
 *
 * Parses the TypeScript file once and reuses the resolved type information
 * across multiple mock-generation calls. This avoids re-parsing on every call.
 *
 * @example
 * ```typescript
 * const ctx = createMockContext("./types.ts");
 * const user = ctx.mock("User");
 * const admin = ctx.mock("Admin");
 * const users = ctx.many("User", 10);
 * const types = ctx.listTypes();
 * ```
 */

import type { ITypeResolver } from "./type-resolver-interface.js";
import { TypeResolver } from "./type-resolver.js";
import { MockGenerator } from "./mock-generator.js";
import type { MockOptions, ResolvedTypes } from "../types/index.js";

export class MockContext {
  private resolver: ITypeResolver;
  private resolvedTypes: ResolvedTypes;
  private defaultOptions: Omit<MockOptions, "filePath">;
  private lazyMode: boolean;

  /**
   * Create a MockContext from a file path or a custom ITypeResolver.
   *
   * @param filePathOrResolver - Path to .ts file or an ITypeResolver instance
   * @param defaultOptions - Default mock generation options
   */
  constructor(
    filePathOrResolver: string | ITypeResolver,
    defaultOptions: Omit<MockOptions, "filePath"> & { lazy?: boolean } = {}
  ) {
    const { lazy = false, ...opts } = defaultOptions;
    this.resolver =
      typeof filePathOrResolver === "string"
        ? new TypeResolver(filePathOrResolver)
        : filePathOrResolver;
    this.lazyMode = lazy;
    this.resolvedTypes = lazy ? {} : this.resolver.resolveAllTypes();
    this.defaultOptions = opts;
  }

  /** The resolved file path. */
  get filePath(): string {
    return this.resolver.filePath;
  }

  /**
   * Ensure a type is resolved (lazy-loads it if not yet cached).
   */
  private ensureTypeResolved(typeName: string): void {
    if (this.resolvedTypes[typeName]) return;

    if (this.lazyMode) {
      const typeNode = this.resolver.resolveType(typeName);
      if (typeNode) {
        this.resolvedTypes[typeName] = typeNode;
        return;
      }
    }

    if (Object.keys(this.resolvedTypes).length === 0) {
      this.resolvedTypes = this.resolver.resolveAllTypes();
    }
  }

  /**
   * Generate a single mock object.
   */
  mock(typeName: string, options: Omit<MockOptions, "filePath"> = {}): unknown {
    this.ensureTypeResolved(typeName);
    if (!this.resolvedTypes[typeName]) {
      throw new Error(
        `Type "${typeName}" not found in "${this.filePath}". ` +
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
   * Generate multiple mock objects.
   */
  many(
    typeName: string,
    count: number,
    options: Omit<MockOptions, "filePath"> = {}
  ): unknown[] {
    this.ensureTypeResolved(typeName);
    if (!this.resolvedTypes[typeName]) {
      throw new Error(
        `Type "${typeName}" not found in "${this.filePath}". ` +
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

  /** Alias for `mock()`. */
  createMock(typeName: string, options: Omit<MockOptions, "filePath"> = {}): unknown {
    return this.mock(typeName, options);
  }

  /** Alias for `many()`. */
  createMany(
    typeName: string,
    count: number,
    options: Omit<MockOptions, "filePath"> = {}
  ): unknown[] {
    return this.many(typeName, count, options);
  }

  /** List all available type names. */
  listTypes(): string[] {
    if (this.lazyMode && Object.keys(this.resolvedTypes).length === 0) {
      this.resolvedTypes = this.resolver.resolveAllTypes();
    }
    return Object.keys(this.resolvedTypes);
  }

  /** Get the raw resolved types map. */
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
 * @param filePathOrResolver - Path to .ts file or an ITypeResolver instance
 * @param defaultOptions - Default options applied to all mock generation calls
 * @returns A MockContext instance
 *
 * @example
 * ```typescript
 * const ctx = createMockContext("./types.ts", { seed: 42 });
 * const user = ctx.mock("User");
 * const users = ctx.many("User", 10);
 * ```
 */
export function createMockContext(
  filePathOrResolver: string | ITypeResolver,
  defaultOptions: Omit<MockOptions, "filePath"> = {}
): MockContext {
  return new MockContext(filePathOrResolver, defaultOptions);
}

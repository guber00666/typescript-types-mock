/**
 * MockContextBase — browser-safe caching wrapper around ITypeResolver and MockGenerator.
 *
 * This base class accepts any ITypeResolver implementation and does NOT
 * depend on Node.js APIs. The Node-specific `MockContext` in mock-context.ts
 * extends this to add file-path-based construction via TypeResolver.
 *
 * @example
 * ```typescript
 * // Browser usage:
 * import schema from "./types.schema.json";
 * import { BrowserTypeResolver } from "typescript-types-mock/browser";
 * import { MockContextBase } from "typescript-types-mock/browser";
 *
 * const resolver = new BrowserTypeResolver(schema);
 * const ctx = new MockContextBase(resolver);
 * const user = ctx.mock("User");
 * ```
 */

import type { ITypeResolver } from "./type-resolver-interface.js";
import { MockGenerator } from "./mock-generator.js";
import type { MockOptions, ResolvedTypes } from "../types/index.js";

export class MockContextBase {
  protected resolver: ITypeResolver;
  protected resolvedTypes: ResolvedTypes;
  protected defaultOptions: Omit<MockOptions, "filePath">;
  protected lazyMode: boolean;

  constructor(
    resolver: ITypeResolver,
    defaultOptions: Omit<MockOptions, "filePath"> & { lazy?: boolean } = {}
  ) {
    const { lazy = false, ...opts } = defaultOptions;
    this.resolver = resolver;
    this.lazyMode = lazy;
    this.resolvedTypes = lazy ? {} : this.resolver.resolveAllTypes();
    this.defaultOptions = opts;
  }

  /**
   * The resolved file path (may be virtual in browser).
   */
  get filePath(): string {
    return this.resolver.filePath;
  }

  /**
   * Ensure a type is resolved (lazy-loads it if not yet cached).
   */
  protected ensureTypeResolved(typeName: string): void {
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

  createMock(typeName: string, options: Omit<MockOptions, "filePath"> = {}): unknown {
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

  createMany(
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

  mock(typeName: string, options: Omit<MockOptions, "filePath"> = {}): unknown {
    return this.createMock(typeName, options);
  }

  many(typeName: string, count: number, options: Omit<MockOptions, "filePath"> = {}): unknown[] {
    return this.createMany(typeName, count, options);
  }

  listTypes(): string[] {
    if (this.lazyMode && Object.keys(this.resolvedTypes).length === 0) {
      this.resolvedTypes = this.resolver.resolveAllTypes();
    }
    return Object.keys(this.resolvedTypes);
  }

  getResolvedTypes(): ResolvedTypes {
    return this.resolvedTypes;
  }
}

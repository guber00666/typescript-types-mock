/**
 * MockContext — a caching wrapper around TypeResolver and MockGenerator.
 *
 * Instead of re-parsing the TypeScript file on every call (expensive ts-morph
 * initialization), MockContext parses the file once and reuses the resolved
 * type information across multiple mock-generation calls.
 *
 * For browser usage, use `MockContextBase` from `./mock-context-base.js`
 * with a `BrowserTypeResolver` instead.
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

import type { ITypeResolver } from "./type-resolver-interface.js";
import { TypeResolver } from "./type-resolver.js";
import { MockContextBase } from "./mock-context-base.js";
import type { MockOptions } from "../types/index.js";

export { MockContextBase } from "./mock-context-base.js";

export class MockContext extends MockContextBase {
  /**
   * Create a MockContext from a file path (Node.js) or a pre-built resolver (Browser).
   *
   * @param filePathOrResolver - Path to .ts file (Node) or an ITypeResolver instance (Browser)
   * @param defaultOptions - Default mock generation options
   */
  constructor(
    filePathOrResolver: string | ITypeResolver,
    defaultOptions: Omit<MockOptions, "filePath"> & { lazy?: boolean } = {}
  ) {
    const resolver =
      typeof filePathOrResolver === "string"
        ? new TypeResolver(filePathOrResolver)
        : filePathOrResolver;
    super(resolver, defaultOptions);
  }
}

/**
 * Create a caching mock context for a TypeScript file or pre-built resolver.
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
 * // Node.js usage:
 * const ctx = createMockContext("./types.ts", { seed: 42 });
 * const user = ctx.createMock("User");
 *
 * // Browser usage:
 * const resolver = new BrowserTypeResolver(schema);
 * const ctx = createMockContext(resolver);
 * const user = ctx.createMock("User");
 * ```
 */
export function createMockContext(
  filePathOrResolver: string | ITypeResolver,
  defaultOptions: Omit<MockOptions, "filePath"> = {}
): MockContext {
  return new MockContext(filePathOrResolver, defaultOptions);
}

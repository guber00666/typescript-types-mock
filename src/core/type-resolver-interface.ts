/**
 * Abstract interface for type resolution.
 *
 * Two implementations exist:
 * - `TypeResolver` (Node.js) — parses .ts files using ts-morph at runtime
 * - `BrowserTypeResolver` (Browser) — uses pre-built JSON schema
 */

import type { ResolvedTypes, TypeNode } from "../types/index.js";

export interface ITypeResolver {
  /** Resolve all exported types. */
  resolveAllTypes(): ResolvedTypes;

  /** Resolve a single type by name. Returns undefined if not found. */
  resolveType(typeName: string): TypeNode | undefined;

  /** The resolved file path (may be virtual in browser). */
  readonly filePath: string;
}

/**
 * Abstract interface for type resolution.
 *
 * The main implementation is `TypeResolver` which parses .ts files
 * using ts-morph at runtime, including cross-module and npm package types.
 */

import type { ResolvedTypes, TypeNode } from "../types/index.js";

export interface ITypeResolver {
  /** Resolve all exported types. */
  resolveAllTypes(): ResolvedTypes;

  /** Resolve a single type by name. Returns undefined if not found. */
  resolveType(typeName: string): TypeNode | undefined;

  /** The resolved file path. */
  readonly filePath: string;
}

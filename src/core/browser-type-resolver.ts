/**
 * BrowserTypeResolver — a zero-dependency type resolver for browser environments.
 *
 * Instead of parsing .ts files at runtime (which requires ts-morph and Node.js),
 * it uses a pre-built JSON schema generated at build time by the CLI tool.
 *
 * @example
 * ```typescript
 * import userSchema from "./user.schema.json";
 * import { BrowserTypeResolver } from "typescript-types-mock/browser";
 *
 * const resolver = new BrowserTypeResolver(userSchema);
 * const types = resolver.resolveAllTypes();
 * ```
 */

import type { ITypeResolver } from "./type-resolver-interface.js";
import type { ResolvedTypes, TypeNode } from "../types/index.js";

/**
 * Schema type accepted by browser APIs.
 *
 * JSON imports widen literal types (`"interface"` → `string`),
 * so we accept a loose record and cast internally.
 */
export type TypeSchema = Record<string, unknown>;

export class BrowserTypeResolver implements ITypeResolver {
  private resolvedTypes: ResolvedTypes;
  public readonly filePath: string;

  /**
   * Create a BrowserTypeResolver from a pre-built schema.
   *
   * @param schema - A schema object (typically imported from a .schema.json file)
   * @param virtualPath - Optional virtual path identifier for the schema source
   */
  constructor(schema: TypeSchema, virtualPath?: string) {
    this.resolvedTypes = schema as unknown as ResolvedTypes;
    this.filePath = virtualPath ?? "<browser-schema>";
  }

  resolveAllTypes(): ResolvedTypes {
    return this.resolvedTypes;
  }

  resolveType(typeName: string): TypeNode | undefined {
    return this.resolvedTypes[typeName];
  }
}

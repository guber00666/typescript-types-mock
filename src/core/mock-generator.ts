/**
 * Mock Generator — takes a TypeNode and produces a mock value.
 */

import {
  TypeNode,
  TypeKind,
  MockOptions,
  PropertyNode,
  InterfaceTypeNode,
  ClassTypeNode,
  EnumTypeNode,
  ResolvedTypes,
} from "../types/index.js";
import { RandomGenerator } from "../utils/random.js";

const DEFAULT_MAX_DEPTH = 5;
const DEFAULT_ARRAY_LENGTH = 2;

export class MockGenerator {
  private resolvedTypes: ResolvedTypes;
  private options: Required<
    Pick<MockOptions, "maxDepth" | "arrayLength" | "includeOptional">
  > &
    MockOptions;
  private visitedTypes: Set<string> = new Set();
  private rng: RandomGenerator;

  constructor(resolvedTypes: ResolvedTypes, options: MockOptions = {}) {
    this.resolvedTypes = resolvedTypes;
    this.options = {
      ...options,
      maxDepth: options.maxDepth ?? DEFAULT_MAX_DEPTH,
      arrayLength: options.arrayLength ?? DEFAULT_ARRAY_LENGTH,
      includeOptional: options.includeOptional ?? true,
    };
    this.rng = new RandomGenerator(options.seed);
  }

  /**
   * Generate a mock value for a given type name.
   * Resets the visited-types tracker on each call so that
   * repeated calls on the same MockGenerator instance work correctly.
   */
  generate(typeName: string): unknown {
    const typeNode = this.resolvedTypes[typeName];
    if (!typeNode) {
      throw new Error(`Type "${typeName}" not found in the resolved types.`);
    }
    // Reset visited types for each top-level generate() call
    this.visitedTypes = new Set();
    return this.generateValue(typeNode, 0);
  }

  /**
   * Generate a mock value for a TypeNode at a given depth.
   */
  generateValue(node: TypeNode, depth: number): unknown {
    if (depth > this.options.maxDepth) {
      return undefined;
    }

    switch (node.kind) {
      case TypeKind.String:
        return this.options.generators?.string?.() ?? this.rng.string();

      case TypeKind.Number:
        return this.options.generators?.number?.() ?? this.rng.number();

      case TypeKind.Boolean:
        return this.options.generators?.boolean?.() ?? this.rng.boolean();

      case TypeKind.BigInt:
        // JSON-safe: generate number instead of BigInt (BigInt crashes JSON.stringify)
        return this.rng.number(0, 1_000_000);

      case TypeKind.Symbol:
        // JSON-safe: generate string instead of Symbol (Symbol is lost in serialization)
        return "mock-symbol-" + this.rng.number(0, 10000);

      case TypeKind.Null:
        return null;

      case TypeKind.Undefined:
      case TypeKind.Void:
        return undefined;

      case TypeKind.Never:
        throw new Error("Cannot generate mock for 'never' type");

      case TypeKind.Any:
      case TypeKind.Unknown:
        return this.generateAny();

      case TypeKind.Literal:
        return node.value;

      case TypeKind.Array:
        return this.generateArray(node.elementType, depth);

      case TypeKind.Tuple:
        return this.generateTuple(node.elements, depth);

      case TypeKind.Object:
        return this.generateObject(node.properties, depth);

      case TypeKind.Interface:
        return this.generateInterface(node, depth);

      case TypeKind.Class:
        return this.generateClass(node, depth);

      case TypeKind.Enum:
        return this.generateEnum(node);

      case TypeKind.Union:
        return this.generateUnion(node.types, depth);

      case TypeKind.Intersection:
        return this.generateIntersection(node.types, depth);

      case TypeKind.TypeReference:
        return this.generateTypeReference(node.name, node.typeArguments, depth);

      case TypeKind.Function:
        return this.generateFunction();

      case TypeKind.Record:
        return this.generateRecord(node.keyType, node.valueType, depth);

      case TypeKind.Partial:
        return this.generatePartial(node.innerType, depth);

      case TypeKind.Required:
        return this.generateRequired(node.innerType, depth);

      case TypeKind.Pick:
        return this.generatePick(node.innerType, node.keys, depth);

      case TypeKind.Omit:
        return this.generateOmit(node.innerType, node.keys, depth);

      case TypeKind.Map:
        // JSON-safe: generate a plain object instead of Map
        return this.generateMap(node.keyType, node.valueType, depth);

      case TypeKind.Set:
        // JSON-safe: generate an array instead of Set
        return this.generateSet(node.elementType, depth);

      case TypeKind.Date:
        // JSON-safe: generate ISO string instead of Date object
        return (this.options.generators?.date?.() ?? this.rng.date()).toISOString();

      case TypeKind.RegExp:
        // JSON-safe: generate a string pattern instead of RegExp
        return "^mock-pattern$";

      case TypeKind.Promise:
        // JSON-safe: return the resolved value directly, not wrapped in Promise
        return this.generateValue(node.innerType, depth + 1);

      case TypeKind.Optional:
        return this.options.includeOptional && this.rng.boolean()
          ? this.generateValue(node.innerType, depth + 1)
          : undefined;

      default:
        return undefined;
    }
  }

  /**
   * Generate a mock for "any" or "unknown" type.
   */
  private generateAny(): unknown {
    const generators = [
      () => this.rng.string(),
      () => this.rng.number(),
      () => this.rng.boolean(),
      () => null,
    ];
    return this.rng.pick(generators)();
  }

  /**
   * Generate an array of mock values.
   */
  private generateArray(elementType: TypeNode, depth: number): unknown[] {
    return Array.from({ length: this.options.arrayLength }, () =>
      this.generateValue(elementType, depth + 1)
    );
  }

  /**
   * Generate a tuple of mock values.
   */
  private generateTuple(elements: TypeNode[], depth: number): unknown[] {
    return elements.map((el) => this.generateValue(el, depth + 1));
  }

  /**
   * Generate a plain object from properties.
   */
  private generateObject(properties: PropertyNode[], depth: number): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const prop of properties) {
      // Skip optional properties if configured
      if (prop.optional && !this.options.includeOptional) {
        continue;
      }

      // For optional properties, randomly include them
      if (prop.optional && !this.rng.boolean()) {
        continue;
      }

      let value: unknown;

      // Use property-name-aware generators for string types
      if (prop.type.kind === TypeKind.String) {
        const semantic = this.options.generators?.string?.() ?? this.rng.stringForProperty(prop.name);
        value = semantic ?? this.generateValue(prop.type, depth + 1);
      } else {
        value = this.generateValue(prop.type, depth + 1);
      }

      // Apply overrides (supports nested merging for objects)
      if (this.options.overrides && prop.name in this.options.overrides) {
        const override = this.options.overrides[prop.name];

        if (
          typeof override === "object" &&
          override !== null &&
          !Array.isArray(override) &&
          typeof value === "object" &&
          value !== null &&
          !Array.isArray(value)
        ) {
          // Deep merge: keep generated values and apply overrides on top
          value = { ...(value as Record<string, unknown>), ...(override as Record<string, unknown>) };
        } else {
          value = override;
        }
      }

      result[prop.name] = value;
    }

    return result;
  }

  /**
   * Generate a mock for an interface type.
   */
  private generateInterface(node: InterfaceTypeNode, depth: number): Record<string, unknown> {
    if (this.visitedTypes.has(node.name) && depth > 1) {
      return {};
    }
    this.visitedTypes.add(node.name);

    const result = this.generateObject(node.properties, depth);

    // Handle extends: merge parent properties
    for (const parentName of node.extends) {
      const parentType = this.resolvedTypes[parentName];
      if (parentType) {
        const parentValue = this.generateValue(parentType, depth + 1);
        if (typeof parentValue === "object" && parentValue !== null) {
          Object.assign(result, parentValue);
        }
      }
    }

    this.visitedTypes.delete(node.name);

    // Note: overrides are already applied in generateObject() with proper merging
    return result;
  }

  /**
   * Generate a mock for a class type.
   */
  private generateClass(node: ClassTypeNode, depth: number): Record<string, unknown> {
    if (this.visitedTypes.has(node.name) && depth > 1) {
      return {};
    }
    this.visitedTypes.add(node.name);

    const result = this.generateObject(node.properties, depth);

    // Handle extends
    if (node.extends) {
      const parentType = this.resolvedTypes[node.extends];
      if (parentType) {
        const parentValue = this.generateValue(parentType, depth + 1);
        if (typeof parentValue === "object" && parentValue !== null) {
          Object.assign(result, parentValue);
        }
      }
    }

    this.visitedTypes.delete(node.name);

    return result;
  }

  /**
   * Generate a mock for an enum type (picks a random member).
   */
  private generateEnum(node: EnumTypeNode): string | number {
    const member = this.rng.pick(node.members);
    return member.value;
  }

  /**
   * Generate a mock for a union type (picks one of the union members).
   */
  private generateUnion(types: TypeNode[], depth: number): unknown {
    // Filter out never types
    const validTypes = types.filter((t) => t.kind !== TypeKind.Never);
    if (validTypes.length === 0) {
      return undefined;
    }

    // For nullable unions (T | null), prefer non-null
    const nonNullTypes = validTypes.filter(
      (t) => t.kind !== TypeKind.Null && t.kind !== TypeKind.Undefined
    );

    if (nonNullTypes.length > 0 && this.rng.boolean()) {
      return this.generateValue(this.rng.pick(nonNullTypes), depth + 1);
    }

    return this.generateValue(this.rng.pick(validTypes), depth + 1);
  }

  /**
   * Generate a mock for an intersection type (merges all types).
   */
  private generateIntersection(types: TypeNode[], depth: number): unknown {
    let result: Record<string, unknown> = {};

    for (const type of types) {
      const value = this.generateValue(type, depth + 1);
      if (typeof value === "object" && value !== null && !Array.isArray(value)) {
        result = { ...result, ...value };
      }
    }

    return result;
  }

  /**
   * Generate a mock for a type reference.
   * Supports generic type argument substitution: ApiResponse<User> → substitutes T with User.
   */
  private generateTypeReference(
    name: string,
    typeArguments: TypeNode[],
    depth: number
  ): unknown {
    const resolvedType = this.resolvedTypes[name];
    if (!resolvedType) {
      // Unknown reference — return a placeholder
      return undefined;
    }

    // If there are type arguments and the resolved type has type parameters,
    // substitute them (e.g., ApiResponse<User> → data: User instead of data: T)
    if (
      typeArguments.length > 0 &&
      resolvedType.kind === TypeKind.Interface &&
      resolvedType.typeParameters.length > 0
    ) {
      const paramMapping = new Map<string, TypeNode>();
      resolvedType.typeParameterNames.forEach((paramName, index) => {
        if (typeArguments[index]) {
          paramMapping.set(paramName, typeArguments[index]!);
        }
      });

      if (paramMapping.size > 0) {
        const substituted = this.substituteTypeParams(resolvedType, paramMapping);
        return this.generateValue(substituted, depth + 1);
      }
    }

    return this.generateValue(resolvedType, depth + 1);
  }

  /**
   * Deep-clone a TypeNode and replace type parameter references with concrete types.
   */
  private substituteTypeParams(node: TypeNode, mapping: Map<string, TypeNode>): TypeNode {
    // If this is a TypeReference to a type parameter name, substitute it
    if (node.kind === TypeKind.TypeReference && mapping.has(node.name) && node.typeArguments.length === 0) {
      return mapping.get(node.name)!;
    }

    switch (node.kind) {
      case TypeKind.Interface:
        return {
          ...node,
          properties: node.properties.map((p) => ({
            ...p,
            type: this.substituteTypeParams(p.type, mapping),
          })),
        };

      case TypeKind.Object:
        return {
          ...node,
          properties: node.properties.map((p) => ({
            ...p,
            type: this.substituteTypeParams(p.type, mapping),
          })),
        };

      case TypeKind.Array:
        return {
          ...node,
          elementType: this.substituteTypeParams(node.elementType, mapping),
        };

      case TypeKind.Union:
        return {
          ...node,
          types: node.types.map((t) => this.substituteTypeParams(t, mapping)),
        };

      case TypeKind.Intersection:
        return {
          ...node,
          types: node.types.map((t) => this.substituteTypeParams(t, mapping)),
        };

      case TypeKind.Tuple:
        return {
          ...node,
          elements: node.elements.map((e) => this.substituteTypeParams(e, mapping)),
        };

      case TypeKind.Record:
        return {
          ...node,
          keyType: this.substituteTypeParams(node.keyType, mapping),
          valueType: this.substituteTypeParams(node.valueType, mapping),
        };

      case TypeKind.Map:
        return {
          ...node,
          keyType: this.substituteTypeParams(node.keyType, mapping),
          valueType: this.substituteTypeParams(node.valueType, mapping),
        };

      case TypeKind.Set:
        return {
          ...node,
          elementType: this.substituteTypeParams(node.elementType, mapping),
        };

      case TypeKind.Partial:
        return {
          ...node,
          innerType: this.substituteTypeParams(node.innerType, mapping),
        };

      case TypeKind.Required:
        return {
          ...node,
          innerType: this.substituteTypeParams(node.innerType, mapping),
        };

      case TypeKind.Promise:
        return {
          ...node,
          innerType: this.substituteTypeParams(node.innerType, mapping),
        };

      case TypeKind.TypeReference:
        if (mapping.has(node.name) && node.typeArguments.length === 0) {
          return mapping.get(node.name)!;
        }
        return {
          ...node,
          typeArguments: node.typeArguments.map((a) => this.substituteTypeParams(a, mapping)),
        };

      default:
        return node;
    }
  }

  /**
   * Generate a mock function (no-op stub).
   */
  private generateFunction(): (...args: unknown[]) => undefined {
    return () => undefined;
  }

  /**
   * Generate a Record<K, V> mock.
   */
  private generateRecord(
    keyType: TypeNode,
    valueType: TypeNode,
    depth: number
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    const count = this.options.arrayLength;

    for (let i = 0; i < count; i++) {
      const key = this.generateKeyString(keyType, i);
      result[key] = this.generateValue(valueType, depth + 1);
    }

    return result;
  }

  /**
   * Generate a Partial<T> mock (all properties optional).
   */
  private generatePartial(innerType: TypeNode, depth: number): unknown {
    const value = this.generateValue(innerType, depth + 1);
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      const obj = value as Record<string, unknown>;
      const keys = Object.keys(obj);
      // Randomly omit some properties
      const result: Record<string, unknown> = {};
      for (const key of keys) {
        if (this.rng.boolean()) {
          result[key] = obj[key];
        }
      }
      return result;
    }
    return value;
  }

  /**
   * Generate a Required<T> mock (all properties required).
   */
  private generateRequired(innerType: TypeNode, depth: number): unknown {
    return this.generateValue(innerType, depth + 1);
  }

  /**
   * Generate a Pick<T, K> mock (only specified properties).
   */
  private generatePick(innerType: TypeNode, keys: string[], depth: number): unknown {
    const value = this.generateValue(innerType, depth + 1);
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      const obj = value as Record<string, unknown>;
      const result: Record<string, unknown> = {};
      for (const key of keys) {
        if (key in obj) {
          result[key] = obj[key];
        }
      }
      return result;
    }
    return value;
  }

  /**
   * Generate an Omit<T, K> mock (exclude specified properties).
   */
  private generateOmit(innerType: TypeNode, keys: string[], depth: number): unknown {
    const value = this.generateValue(innerType, depth + 1);
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      const obj = value as Record<string, unknown>;
      const result: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(obj)) {
        if (!keys.includes(key)) {
          result[key] = val;
        }
      }
      return result;
    }
    return value;
  }

  /**
   * Generate a Map<K, V> mock as a plain object (JSON-safe).
   */
  private generateMap(
    keyType: TypeNode,
    valueType: TypeNode,
    depth: number
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    const count = this.options.arrayLength;

    for (let i = 0; i < count; i++) {
      const key = this.generateKeyString(keyType, i);
      const value = this.generateValue(valueType, depth + 1);
      result[key] = value;
    }

    return result;
  }

  /**
   * Generate a Set<T> mock as an array (JSON-safe).
   */
  private generateSet(elementType: TypeNode, depth: number): unknown[] {
    const result: unknown[] = [];
    const count = this.options.arrayLength;
    const seen = new Set<string>();

    for (let i = 0; i < count; i++) {
      const value = this.generateValue(elementType, depth + 1);
      const key = JSON.stringify(value);
      // Ensure uniqueness like a real Set
      if (!seen.has(key)) {
        seen.add(key);
        result.push(value);
      }
    }

    return result;
  }

  /**
   * Generate a string key for Record types.
   */
  private generateKeyString(keyType: TypeNode, index: number): string {
    if (keyType.kind === TypeKind.Literal && typeof keyType.value === "string") {
      return keyType.value;
    }
    if (keyType.kind === TypeKind.Union) {
      const stringLiterals = keyType.types.filter(
        (t): t is { kind: TypeKind.Literal; value: string | number | boolean } =>
          t.kind === TypeKind.Literal && typeof t.value === "string"
      );
      if (stringLiterals.length > index) {
        return stringLiterals[index]!.value as string;
      }
    }
    return `key_${index}`;
  }
}

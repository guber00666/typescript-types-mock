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
import {
  randomString,
  randomNumber,
  randomBoolean,
  randomBigInt,
  randomDate,
  randomPick,
} from "../utils/random.js";

const DEFAULT_MAX_DEPTH = 5;
const DEFAULT_ARRAY_LENGTH = 2;

export class MockGenerator {
  private resolvedTypes: ResolvedTypes;
  private options: Required<
    Pick<MockOptions, "maxDepth" | "arrayLength" | "includeOptional">
  > &
    MockOptions;
  private visitedTypes: Set<string> = new Set();

  constructor(resolvedTypes: ResolvedTypes, options: MockOptions = {}) {
    this.resolvedTypes = resolvedTypes;
    this.options = {
      ...options,
      maxDepth: options.maxDepth ?? DEFAULT_MAX_DEPTH,
      arrayLength: options.arrayLength ?? DEFAULT_ARRAY_LENGTH,
      includeOptional: options.includeOptional ?? true,
    };
  }

  /**
   * Generate a mock value for a given type name.
   */
  generate(typeName: string): unknown {
    const typeNode = this.resolvedTypes[typeName];
    if (!typeNode) {
      throw new Error(`Type "${typeName}" not found in the resolved types.`);
    }
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
        return this.options.generators?.string?.() ?? randomString();

      case TypeKind.Number:
        return this.options.generators?.number?.() ?? randomNumber();

      case TypeKind.Boolean:
        return this.options.generators?.boolean?.() ?? randomBoolean();

      case TypeKind.BigInt:
        return randomBigInt();

      case TypeKind.Symbol:
        return Symbol("mock");

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
        return this.generateMap(node.keyType, node.valueType, depth);

      case TypeKind.Set:
        return this.generateSet(node.elementType, depth);

      case TypeKind.Date:
        return this.options.generators?.date?.() ?? randomDate();

      case TypeKind.RegExp:
        return /mock-regex/g;

      case TypeKind.Promise:
        return Promise.resolve(this.generateValue(node.innerType, depth + 1));

      case TypeKind.Optional:
        return this.options.includeOptional && randomBoolean()
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
      () => randomString(),
      () => randomNumber(),
      () => randomBoolean(),
      () => null,
    ];
    return randomPick(generators)();
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
      if (prop.optional && !randomBoolean()) {
        continue;
      }

      let value = this.generateValue(prop.type, depth + 1);

      // Apply overrides
      if (this.options.overrides && prop.name in this.options.overrides) {
        value = this.options.overrides[prop.name];
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

    // Apply overrides
    if (this.options.overrides) {
      for (const [key, value] of Object.entries(this.options.overrides)) {
        if (key in result) {
          result[key] = value;
        }
      }
    }

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
    const member = randomPick(node.members);
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

    if (nonNullTypes.length > 0 && randomBoolean()) {
      return this.generateValue(randomPick(nonNullTypes), depth + 1);
    }

    return this.generateValue(randomPick(validTypes), depth + 1);
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
   */
  private generateTypeReference(
    name: string,
    _typeArguments: TypeNode[],
    depth: number
  ): unknown {
    const resolvedType = this.resolvedTypes[name];
    if (resolvedType) {
      return this.generateValue(resolvedType, depth + 1);
    }
    // Unknown reference — return a placeholder
    return undefined;
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
        if (randomBoolean()) {
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
   * Generate a Map<K, V> mock.
   */
  private generateMap(
    keyType: TypeNode,
    valueType: TypeNode,
    depth: number
  ): Map<unknown, unknown> {
    const map = new Map();
    const count = this.options.arrayLength;

    for (let i = 0; i < count; i++) {
      const key = this.generateValue(keyType, depth + 1);
      const value = this.generateValue(valueType, depth + 1);
      map.set(key, value);
    }

    return map;
  }

  /**
   * Generate a Set<T> mock.
   */
  private generateSet(elementType: TypeNode, depth: number): Set<unknown> {
    const set = new Set();
    const count = this.options.arrayLength;

    for (let i = 0; i < count; i++) {
      set.add(this.generateValue(elementType, depth + 1));
    }

    return set;
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

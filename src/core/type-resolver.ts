/**
 * Type Resolver — parses TypeScript source files using ts-morph
 * and extracts type information into our internal TypeNode representation.
 */

import {
  Project,
  SourceFile,
  InterfaceDeclaration,
  TypeAliasDeclaration,
  EnumDeclaration,
  ClassDeclaration,
  TypeNode as TsMorphTypeNode,
  SyntaxKind,
  PropertySignature,
  PropertyDeclaration,
  ts,
} from "ts-morph";
import * as fs from "fs";
import * as pathModule from "path";
import {
  TypeNode,
  TypeKind,
  PropertyNode,
  ResolvedTypes,
} from "../types/index.js";

export class TypeResolver {
  private project: Project;
  private sourceFile: SourceFile;
  private resolving: Set<string> = new Set();

  /** The resolved absolute path of the source file */
  public readonly filePath: string;

  constructor(filePath: string) {
    // Normalize to absolute path
    const absolutePath = pathModule.resolve(filePath);

    // Validate file existence
    if (!fs.existsSync(absolutePath)) {
      throw new Error(
        `TypeResolver: file not found: "${absolutePath}". ` +
        `Make sure the path is correct and the file exists. ` +
        `Original path: "${filePath}", CWD: "${process.cwd()}"`
      );
    }

    // Validate it's a .ts file
    if (!absolutePath.endsWith(".ts") && !absolutePath.endsWith(".tsx")) {
      throw new Error(
        `TypeResolver: expected a .ts or .tsx file, got: "${absolutePath}"`
      );
    }

    this.filePath = absolutePath;
    const tsConfigPath = this.findTsConfig(absolutePath);

    this.project = new Project(
      tsConfigPath
        ? {
            tsConfigFilePath: tsConfigPath,
            skipAddingFilesFromTsConfig: true,
          }
        : {
            compilerOptions: {
              target: ts.ScriptTarget.ES2022,
              module: ts.ModuleKind.ESNext,
              moduleResolution: ts.ModuleResolutionKind.Bundler,
              strict: true,
            },
          }
    );
    this.sourceFile = this.project.addSourceFileAtPath(absolutePath);
  }

  /**
   * Walk up the directory tree from the file's location to find a tsconfig.json.
   */
  private findTsConfig(filePath: string): string | undefined {
    const absolutePath = pathModule.resolve(filePath);
    const parts = absolutePath.split(pathModule.sep);
    parts.pop(); // remove file name

    while (parts.length > 0) {
      const dir = parts.join(pathModule.sep) || "/";
      const candidate = pathModule.join(dir, "tsconfig.json");
      if (fs.existsSync(candidate)) {
        return candidate;
      }
      parts.pop();
    }
    return undefined;
  }

  /**
   * Resolve all exported types from the source file.
   */
  resolveAllTypes(): ResolvedTypes {
    const types: ResolvedTypes = {};

    // Interfaces
    for (const iface of this.sourceFile.getInterfaces()) {
      types[iface.getName()] = this.resolveInterface(iface);
    }

    // Type aliases
    for (const alias of this.sourceFile.getTypeAliases()) {
      types[alias.getName()] = this.resolveTypeAlias(alias);
    }

    // Enums
    for (const enumDecl of this.sourceFile.getEnums()) {
      types[enumDecl.getName()] = this.resolveEnum(enumDecl);
    }

    // Classes
    for (const cls of this.sourceFile.getClasses()) {
      const name = cls.getName();
      if (name) {
        types[name] = this.resolveClass(cls);
      }
    }

    return types;
  }

  /**
   * Resolve a single type by name.
   */
  resolveType(typeName: string): TypeNode | null {
    // Try interface
    const iface = this.sourceFile.getInterface(typeName);
    if (iface) return this.resolveInterface(iface);

    // Try type alias
    const alias = this.sourceFile.getTypeAlias(typeName);
    if (alias) return this.resolveTypeAlias(alias);

    // Try enum
    const enumDecl = this.sourceFile.getEnum(typeName);
    if (enumDecl) return this.resolveEnum(enumDecl);

    // Try class
    const cls = this.sourceFile.getClass(typeName);
    if (cls) return this.resolveClass(cls);

    return null;
  }

  /**
   * Resolve an interface declaration.
   */
  private resolveInterface(iface: InterfaceDeclaration): TypeNode {
    const name = iface.getName();

    // Guard against circular references
    if (this.resolving.has(name)) {
      return { kind: TypeKind.Any };
    }
    this.resolving.add(name);

    const properties = iface.getProperties().map((p) => this.resolvePropertySignature(p));
    // Extract only the base type name, stripping generic arguments
    // e.g. "BaseType<Arg>" → "BaseType"
    const extendsExprs = iface.getExtends().map((e) => {
      const text = e.getText();
      const angleBracket = text.indexOf("<");
      return angleBracket !== -1 ? text.slice(0, angleBracket) : text;
    });
    const typeParameterNames = iface.getTypeParameters().map((tp) => tp.getName());
    const typeParameters = iface.getTypeParameters().map((tp) => {
      const constraint = tp.getConstraint();
      return constraint
        ? this.resolveTsTypeNode(constraint)
        : { kind: TypeKind.Any } as TypeNode;
    });

    this.resolving.delete(name);

    return {
      kind: TypeKind.Interface,
      name,
      properties,
      extends: extendsExprs,
      typeParameters,
      typeParameterNames,
    };
  }

  /**
   * Resolve a type alias declaration.
   */
  private resolveTypeAlias(alias: TypeAliasDeclaration): TypeNode {
    const name = alias.getName();

    if (this.resolving.has(name)) {
      return { kind: TypeKind.Any };
    }
    this.resolving.add(name);

    const typeNode = alias.getTypeNode();
    const result = typeNode ? this.resolveTsTypeNode(typeNode) : { kind: TypeKind.Any } as TypeNode;

    this.resolving.delete(name);

    return result;
  }

  /**
   * Resolve an enum declaration.
   */
  private resolveEnum(enumDecl: EnumDeclaration): TypeNode {
    const members = enumDecl.getMembers().map((m) => {
      const value = m.getValue();
      return {
        name: m.getName(),
        value: value !== undefined ? value : m.getName(),
      };
    });

    return {
      kind: TypeKind.Enum,
      name: enumDecl.getName(),
      members,
    };
  }

  /**
   * Resolve a class declaration.
   */
  private resolveClass(cls: ClassDeclaration): TypeNode {
    const name = cls.getName() ?? "AnonymousClass";

    if (this.resolving.has(name)) {
      return { kind: TypeKind.Any };
    }
    this.resolving.add(name);

    const properties = cls
      .getProperties()
      .filter((p) => p.getScope() === "public" || !p.getScope())
      .map((p) => this.resolvePropertyDeclaration(p));

    const baseClass = cls.getBaseClass();
    // Strip generic arguments from implements expressions
    const implementedInterfaces = cls.getImplements().map((i) => {
      const text = i.getText();
      const angleBracket = text.indexOf("<");
      return angleBracket !== -1 ? text.slice(0, angleBracket) : text;
    });

    this.resolving.delete(name);

    return {
      kind: TypeKind.Class,
      name,
      properties,
      extends: baseClass ? (baseClass.getName() ?? null) : null,
      implements: implementedInterfaces,
    };
  }

  /**
   * Resolve a property signature (from interface).
   */
  private resolvePropertySignature(prop: PropertySignature): PropertyNode {
    const typeNode = prop.getTypeNode();
    const type = typeNode
      ? this.resolveTsTypeNode(typeNode)
      : { kind: TypeKind.Any } as TypeNode;

    return {
      name: prop.getName(),
      type,
      optional: prop.hasQuestionToken(),
      readonly: prop.isReadonly(),
    };
  }

  /**
   * Resolve a property declaration (from class).
   */
  private resolvePropertyDeclaration(prop: PropertyDeclaration): PropertyNode {
    const typeNode = prop.getTypeNode();
    const type = typeNode
      ? this.resolveTsTypeNode(typeNode)
      : { kind: TypeKind.Any } as TypeNode;

    return {
      name: prop.getName(),
      type,
      optional: prop.hasQuestionToken(),
      readonly: prop.isReadonly(),
    };
  }

  /**
   * Resolve a TypeScript AST type node into our internal TypeNode.
   */
  resolveTsTypeNode(node: TsMorphTypeNode): TypeNode {
    const kind = node.getKind();

    switch (kind) {
      // Primitive keyword types
      case SyntaxKind.StringKeyword:
        return { kind: TypeKind.String };
      case SyntaxKind.NumberKeyword:
        return { kind: TypeKind.Number };
      case SyntaxKind.BooleanKeyword:
        return { kind: TypeKind.Boolean };
      case SyntaxKind.NullKeyword:
        return { kind: TypeKind.Null };
      case SyntaxKind.UndefinedKeyword:
        return { kind: TypeKind.Undefined };
      case SyntaxKind.VoidKeyword:
        return { kind: TypeKind.Void };
      case SyntaxKind.BigIntKeyword:
        return { kind: TypeKind.BigInt };
      case SyntaxKind.SymbolKeyword:
        return { kind: TypeKind.Symbol };
      case SyntaxKind.NeverKeyword:
        return { kind: TypeKind.Never };
      case SyntaxKind.AnyKeyword:
        return { kind: TypeKind.Any };
      case SyntaxKind.UnknownKeyword:
        return { kind: TypeKind.Unknown };

      // Literal types
      case SyntaxKind.LiteralType:
        return this.resolveLiteralType(node);

      // Array type: string[]
      case SyntaxKind.ArrayType:
        return this.resolveArrayType(node);

      // Tuple type: [string, number]
      case SyntaxKind.TupleType:
        return this.resolveTupleType(node);

      // Union type: string | number
      case SyntaxKind.UnionType:
        return this.resolveUnionType(node);

      // Intersection type: A & B
      case SyntaxKind.IntersectionType:
        return this.resolveIntersectionType(node);

      // Type literal: { name: string; age: number }
      case SyntaxKind.TypeLiteral:
        return this.resolveTypeLiteral(node);

      // Type reference: SomeType, Array<string>, Record<string, number>
      case SyntaxKind.TypeReference:
        return this.resolveTypeReference(node);

      // Function type
      case SyntaxKind.FunctionType:
        return this.resolveFunctionType(node);

      // Parenthesized type
      case SyntaxKind.ParenthesizedType: {
        // Try to get the inner type node
        const innerNode = node.forEachChild((child) => {
          if (this.isTypeNode(child)) {
            return child as TsMorphTypeNode;
          }
          return undefined;
        });
        if (innerNode) return this.resolveTsTypeNode(innerNode);
        return { kind: TypeKind.Any };
      }

      // Type query (typeof)
      case SyntaxKind.TypeQuery:
        return { kind: TypeKind.Any };

      // Mapped type
      case SyntaxKind.MappedType:
        return this.resolveMappedType(node);

      default:
        // Fallback: try to resolve using the type checker
        return { kind: TypeKind.Any };
    }
  }

  private isTypeNode(node: any): boolean {
    const kind = node?.getKind?.();
    return kind !== undefined && kind !== SyntaxKind.SyntaxList;
  }

  /**
   * Collect type arguments from a TypeReference node.
   * For `Record<string, User>`, this extracts [StringTypeNode, TypeReferenceNode("User")].
   */
  private collectTypeArguments(node: TsMorphTypeNode, result: TypeNode[]): void {
    // Find the SyntaxList child that contains the type arguments
    for (const child of node.getChildren()) {
      if (child.getKind() === SyntaxKind.SyntaxList) {
        // Iterate through direct children of SyntaxList
        for (const typeArgChild of child.getChildren()) {
          const childKind = typeArgChild.getKind();
          // Skip commas, whitespace, etc.
          if (childKind === SyntaxKind.CommaToken) continue;

          if (this.isTypeNode(typeArgChild)) {
            result.push(this.resolveTsTypeNode(typeArgChild as TsMorphTypeNode));
          }
        }
        return;
      }
    }
  }

  /**
   * Resolve a literal type (string literal, number literal, boolean literal).
   */
  private resolveLiteralType(node: TsMorphTypeNode): TypeNode {
    const text = node.getText();

    // String literal: "hello"
    if (text.startsWith('"') || text.startsWith("'")) {
      return {
        kind: TypeKind.Literal,
        value: text.slice(1, -1),
      };
    }

    // Number literal: 42
    if (!isNaN(Number(text))) {
      return {
        kind: TypeKind.Literal,
        value: Number(text),
      };
    }

    // Boolean literal
    if (text === "true") {
      return { kind: TypeKind.Literal, value: true };
    }
    if (text === "false") {
      return { kind: TypeKind.Literal, value: false };
    }

    // null literal (shouldn't reach here but just in case)
    if (text === "null") {
      return { kind: TypeKind.Null };
    }

    return { kind: TypeKind.Any };
  }

  /**
   * Resolve an array type: string[]
   */
  private resolveArrayType(node: TsMorphTypeNode): TypeNode {
    // ArrayType has one child type node (the element type)
    const elementTypeNode = node.forEachChild((child) => {
      if (this.isTypeNode(child)) return child as TsMorphTypeNode;
      return undefined;
    });

    return {
      kind: TypeKind.Array,
      elementType: elementTypeNode
        ? this.resolveTsTypeNode(elementTypeNode)
        : { kind: TypeKind.Any },
    };
  }

  /**
   * Resolve a tuple type: [string, number]
   */
  private resolveTupleType(node: TsMorphTypeNode): TypeNode {
    const elements: TypeNode[] = [];
    node.forEachChild((child) => {
      if (this.isTypeNode(child)) {
        elements.push(this.resolveTsTypeNode(child as TsMorphTypeNode));
      }
    });

    return {
      kind: TypeKind.Tuple,
      elements,
    };
  }

  /**
   * Resolve a union type: string | number
   */
  private resolveUnionType(node: TsMorphTypeNode): TypeNode {
    const types: TypeNode[] = [];
    node.forEachChild((child) => {
      if (this.isTypeNode(child)) {
        types.push(this.resolveTsTypeNode(child as TsMorphTypeNode));
      }
    });

    return {
      kind: TypeKind.Union,
      types,
    };
  }

  /**
   * Resolve an intersection type: A & B
   */
  private resolveIntersectionType(node: TsMorphTypeNode): TypeNode {
    const types: TypeNode[] = [];
    node.forEachChild((child) => {
      if (this.isTypeNode(child)) {
        types.push(this.resolveTsTypeNode(child as TsMorphTypeNode));
      }
    });

    return {
      kind: TypeKind.Intersection,
      types,
    };
  }

  /**
   * Resolve a type literal: { name: string; age: number }
   */
  private resolveTypeLiteral(node: TsMorphTypeNode): TypeNode {
    const properties: PropertyNode[] = [];

    node.forEachDescendant((descendant) => {
      if (descendant.getKind() === SyntaxKind.PropertySignature) {
        const prop = descendant as unknown as PropertySignature;
        properties.push(this.resolvePropertySignature(prop));
      }
    });

    return {
      kind: TypeKind.Object,
      properties,
    };
  }

  /**
   * Resolve a type reference: SomeType, Array<string>, Record<string, number>
   */
  private resolveTypeReference(node: TsMorphTypeNode): TypeNode {
    const text = node.getText();

    // Extract type arguments by traversing child type nodes
    const typeArgs: TypeNode[] = [];
    this.collectTypeArguments(node, typeArgs);

    // Extract the base type name (without type arguments)
    const baseName = text.split("<")[0]?.trim() ?? text;

    // Built-in utility types
    switch (baseName) {
      case "Array":
        return {
          kind: TypeKind.Array,
          elementType: typeArgs[0] ?? { kind: TypeKind.Any },
        };

      case "Record":
        return {
          kind: TypeKind.Record,
          keyType: typeArgs[0] ?? { kind: TypeKind.String },
          valueType: typeArgs[1] ?? { kind: TypeKind.Any },
        };

      case "Partial":
        return {
          kind: TypeKind.Partial,
          innerType: typeArgs[0] ?? { kind: TypeKind.Any },
        };

      case "Required":
        return {
          kind: TypeKind.Required,
          innerType: typeArgs[0] ?? { kind: TypeKind.Any },
        };

      case "Pick": {
        const keys = typeArgs[1] ? this.extractLiteralKeys(typeArgs[1]) : [];
        return {
          kind: TypeKind.Pick,
          innerType: typeArgs[0] ?? { kind: TypeKind.Any },
          keys,
        };
      }

      case "Omit": {
        const keys = typeArgs[1] ? this.extractLiteralKeys(typeArgs[1]) : [];
        return {
          kind: TypeKind.Omit,
          innerType: typeArgs[0] ?? { kind: TypeKind.Any },
          keys,
        };
      }

      case "Map":
        return {
          kind: TypeKind.Map,
          keyType: typeArgs[0] ?? { kind: TypeKind.String },
          valueType: typeArgs[1] ?? { kind: TypeKind.Any },
        };

      case "Set":
        return {
          kind: TypeKind.Set,
          elementType: typeArgs[0] ?? { kind: TypeKind.Any },
        };

      case "Date":
        return { kind: TypeKind.Date };

      case "RegExp":
        return { kind: TypeKind.RegExp };

      case "Promise":
        return {
          kind: TypeKind.Promise,
          innerType: typeArgs[0] ?? { kind: TypeKind.Any },
        };

      case "ReadonlyArray":
        return {
          kind: TypeKind.Array,
          elementType: typeArgs[0] ?? { kind: TypeKind.Any },
        };

      default:
        // It's a reference to a user-defined type
        return {
          kind: TypeKind.TypeReference,
          name: baseName,
          typeArguments: typeArgs,
        };
    }
  }

  /**
   * Resolve a function type: (a: string, b: number) => void
   */
  private resolveFunctionType(_node: TsMorphTypeNode): TypeNode {
    // Simplified: just return a function type node
    return {
      kind: TypeKind.Function,
      parameters: [],
      returnType: { kind: TypeKind.Void },
    };
  }

  /**
   * Resolve a mapped type: { [K in keyof T]: ... }
   */
  private resolveMappedType(node: TsMorphTypeNode): TypeNode {
    return { kind: TypeKind.Object, properties: [] };
  }

  /**
   * Extract literal string keys from a union of string literals.
   * e.g., "name" | "age" → ["name", "age"]
   */
  private extractLiteralKeys(typeNode: TypeNode): string[] {
    if (typeNode.kind === TypeKind.Union) {
      return typeNode.types
        .filter((t): t is { kind: TypeKind.Literal; value: string | number | boolean } =>
          t.kind === TypeKind.Literal && typeof t.value === "string"
        )
        .map((t) => t.value as string);
    }
    if (typeNode.kind === TypeKind.Literal && typeof typeNode.value === "string") {
      return [typeNode.value];
    }
    return [];
  }
}

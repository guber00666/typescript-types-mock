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
import type { ITypeResolver } from "./type-resolver-interface.js";

export class TypeResolver implements ITypeResolver {
  private project: Project;
  private sourceFile: SourceFile;
  private resolving: Set<string> = new Set();

  /** Set of absolute file paths loaded as dependencies */
  private loadedFiles: Set<string> = new Set();

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
    this.loadedFiles.add(absolutePath);

    // Recursively load all imported dependencies (local + npm)
    this.loadDependencies(this.sourceFile);
  }

  /**
   * Recursively load all files reachable via import/export declarations
   * from the given source file. Handles both relative imports and npm packages.
   * Uses a visited set to avoid infinite loops on circular dependencies.
   */
  private loadDependencies(sourceFile: SourceFile): void {
    const filePath = sourceFile.getFilePath();
    if (this.loadedFiles.has(filePath)) {
      // Already processed — mark visited only, don't re-traverse
    } else {
      this.loadedFiles.add(filePath);
    }

    // Process import declarations: import { X } from './models' or 'some-pkg'
    for (const imp of sourceFile.getImportDeclarations()) {
      const resolved = imp.getModuleSpecifierSourceFile();
      if (resolved) {
        const resolvedPath = resolved.getFilePath();
        if (!this.loadedFiles.has(resolvedPath)) {
          let loaded: SourceFile;
          try {
            loaded = this.project.addSourceFileAtPath(resolvedPath);
          } catch {
            loaded = resolved;
          }
          this.loadedFiles.add(resolvedPath);
          this.loadDependencies(loaded);
        }
      }
    }

    // Process export declarations: export { X } from './models' or export * from '...'
    for (const exp of sourceFile.getExportDeclarations()) {
      const resolved = exp.getModuleSpecifierSourceFile();
      if (resolved) {
        const resolvedPath = resolved.getFilePath();
        if (!this.loadedFiles.has(resolvedPath)) {
          let loaded: SourceFile;
          try {
            loaded = this.project.addSourceFileAtPath(resolvedPath);
          } catch {
            loaded = resolved;
          }
          this.loadedFiles.add(resolvedPath);
          this.loadDependencies(loaded);
        }
      }
    }
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
   * Get all source files to scan for types.
   * The entry file is processed last so its types take priority over
   * dependencies in case of name collisions.
   */
  private getAllSourceFiles(): SourceFile[] {
    const mainPath = this.sourceFile.getFilePath();
    const files: SourceFile[] = [];

    for (const sf of this.project.getSourceFiles()) {
      if (sf.getFilePath() !== mainPath) {
        files.push(sf);
      }
    }
    // Entry file last so its types override dependency types on collision
    files.push(this.sourceFile);
    return files;
  }

  /**
   * Resolve all exported types from the source file and its dependencies.
   * Types from the entry file take priority over dependency types.
   */
  resolveAllTypes(): ResolvedTypes {
    const types: ResolvedTypes = {};

    for (const sf of this.getAllSourceFiles()) {
      // Interfaces
      for (const iface of sf.getInterfaces()) {
        const name = iface.getName();
        // Only add if not already defined by the entry file
        if (!(name in types)) {
          types[name] = this.resolveInterface(iface);
        }
      }

      // Type aliases
      for (const alias of sf.getTypeAliases()) {
        const name = alias.getName();
        if (!(name in types)) {
          types[name] = this.resolveTypeAlias(alias);
        }
      }

      // Enums
      for (const enumDecl of sf.getEnums()) {
        const name = enumDecl.getName();
        if (!(name in types)) {
          types[name] = this.resolveEnum(enumDecl);
        }
      }

      // Classes
      for (const cls of sf.getClasses()) {
        const name = cls.getName();
        if (name && !(name in types)) {
          types[name] = this.resolveClass(cls);
        }
      }
    }

    // Handle import aliases: import { Foo as Bar } from '...'
    // For each alias, create an entry pointing to the original type
    for (const sf of this.getAllSourceFiles()) {
      for (const imp of sf.getImportDeclarations()) {
        for (const specifier of imp.getNamedImports()) {
          const aliasNode = specifier.getAliasNode();
          if (aliasNode) {
            const aliasName = aliasNode.getText();
            const originalName = specifier.getName();
            if (!(aliasName in types) && originalName in types) {
              types[aliasName] = types[originalName];
            }
          }
        }
      }
    }

    return types;
  }

  /**
   * Resolve a single type by name across all loaded source files.
   * Searches the entry file first, then dependencies.
   * Also handles import aliases (import { Foo as Bar }).
   */
  resolveType(typeName: string): TypeNode | undefined {
    // Search entry file first
    const entryResult = this.resolveTypeInFile(typeName, this.sourceFile);
    if (entryResult) return entryResult;

    // Then search dependencies
    for (const sf of this.project.getSourceFiles()) {
      if (sf.getFilePath() === this.sourceFile.getFilePath()) continue;
      const result = this.resolveTypeInFile(typeName, sf);
      if (result) return result;
    }

    // Check import aliases: import { Foo as Bar } → if typeName is "Bar", resolve "Foo"
    for (const sf of this.project.getSourceFiles()) {
      for (const imp of sf.getImportDeclarations()) {
        for (const specifier of imp.getNamedImports()) {
          const aliasNode = specifier.getAliasNode();
          if (aliasNode && aliasNode.getText() === typeName) {
            const originalName = specifier.getName();
            return this.resolveType(originalName);
          }
        }
      }
    }

    return undefined;
  }

  /**
   * Try to resolve a type by name within a single source file.
   */
  private resolveTypeInFile(typeName: string, sf: SourceFile): TypeNode | undefined {
    const iface = sf.getInterface(typeName);
    if (iface) return this.resolveInterface(iface);

    const alias = sf.getTypeAlias(typeName);
    if (alias) return this.resolveTypeAlias(alias);

    const enumDecl = sf.getEnum(typeName);
    if (enumDecl) return this.resolveEnum(enumDecl);

    const cls = sf.getClass(typeName);
    if (cls) return this.resolveClass(cls);

    return undefined;
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

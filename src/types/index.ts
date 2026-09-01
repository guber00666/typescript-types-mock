/**
 * Internal type representations parsed from TypeScript AST.
 */

/** Base kind discriminator for all parsed types */
export enum TypeKind {
  String = "string",
  Number = "number",
  Boolean = "boolean",
  Null = "null",
  Undefined = "undefined",
  Void = "void",
  BigInt = "bigint",
  Symbol = "symbol",
  Never = "never",
  Any = "any",
  Unknown = "unknown",
  Literal = "literal",
  Array = "array",
  Tuple = "tuple",
  Object = "object",
  Interface = "interface",
  Class = "class",
  Enum = "enum",
  EnumMember = "enum_member",
  Union = "union",
  Intersection = "intersection",
  TypeReference = "type_reference",
  Function = "function",
  Record = "record",
  Partial = "partial",
  Required = "required",
  Pick = "pick",
  Omit = "omit",
  Map = "map",
  Set = "set",
  Date = "date",
  RegExp = "regexp",
  Promise = "promise",
  Optional = "optional",
}

/** Base type node */
export interface BaseTypeNode {
  kind: TypeKind;
}

export interface StringTypeNode extends BaseTypeNode {
  kind: TypeKind.String;
}

export interface NumberTypeNode extends BaseTypeNode {
  kind: TypeKind.Number;
}

export interface BooleanTypeNode extends BaseTypeNode {
  kind: TypeKind.Boolean;
}

export interface NullTypeNode extends BaseTypeNode {
  kind: TypeKind.Null;
}

export interface UndefinedTypeNode extends BaseTypeNode {
  kind: TypeKind.Undefined;
}

export interface VoidTypeNode extends BaseTypeNode {
  kind: TypeKind.Void;
}

export interface BigIntTypeNode extends BaseTypeNode {
  kind: TypeKind.BigInt;
}

export interface SymbolTypeNode extends BaseTypeNode {
  kind: TypeKind.Symbol;
}

export interface NeverTypeNode extends BaseTypeNode {
  kind: TypeKind.Never;
}

export interface AnyTypeNode extends BaseTypeNode {
  kind: TypeKind.Any;
}

export interface UnknownTypeNode extends BaseTypeNode {
  kind: TypeKind.Unknown;
}

export interface LiteralTypeNode extends BaseTypeNode {
  kind: TypeKind.Literal;
  value: string | number | boolean;
}

export interface ArrayTypeNode extends BaseTypeNode {
  kind: TypeKind.Array;
  elementType: TypeNode;
}

export interface TupleTypeNode extends BaseTypeNode {
  kind: TypeKind.Tuple;
  elements: TypeNode[];
}

export interface PropertyNode {
  name: string;
  type: TypeNode;
  optional: boolean;
  readonly: boolean;
}

export interface ObjectTypeNode extends BaseTypeNode {
  kind: TypeKind.Object;
  properties: PropertyNode[];
}

export interface InterfaceTypeNode extends BaseTypeNode {
  kind: TypeKind.Interface;
  name: string;
  properties: PropertyNode[];
  extends: string[];
  typeParameters: TypeNode[];
}

export interface ClassTypeNode extends BaseTypeNode {
  kind: TypeKind.Class;
  name: string;
  properties: PropertyNode[];
  extends: string | null;
  implements: string[];
}

export interface EnumTypeNode extends BaseTypeNode {
  kind: TypeKind.Enum;
  name: string;
  members: EnumMemberNode[];
}

export interface EnumMemberNode {
  name: string;
  value: string | number;
}

export interface UnionTypeNode extends BaseTypeNode {
  kind: TypeKind.Union;
  types: TypeNode[];
}

export interface IntersectionTypeNode extends BaseTypeNode {
  kind: TypeKind.Intersection;
  types: TypeNode[];
}

export interface TypeReferenceNode extends BaseTypeNode {
  kind: TypeKind.TypeReference;
  name: string;
  typeArguments: TypeNode[];
}

export interface FunctionTypeNode extends BaseTypeNode {
  kind: TypeKind.Function;
  parameters: { name: string; type: TypeNode; optional: boolean }[];
  returnType: TypeNode;
}

export interface RecordTypeNode extends BaseTypeNode {
  kind: TypeKind.Record;
  keyType: TypeNode;
  valueType: TypeNode;
}

export interface PartialTypeNode extends BaseTypeNode {
  kind: TypeKind.Partial;
  innerType: TypeNode;
}

export interface RequiredTypeNode extends BaseTypeNode {
  kind: TypeKind.Required;
  innerType: TypeNode;
}

export interface PickTypeNode extends BaseTypeNode {
  kind: TypeKind.Pick;
  innerType: TypeNode;
  keys: string[];
}

export interface OmitTypeNode extends BaseTypeNode {
  kind: TypeKind.Omit;
  innerType: TypeNode;
  keys: string[];
}

export interface MapTypeNode extends BaseTypeNode {
  kind: TypeKind.Map;
  keyType: TypeNode;
  valueType: TypeNode;
}

export interface SetTypeNode extends BaseTypeNode {
  kind: TypeKind.Set;
  elementType: TypeNode;
}

export interface DateTypeNode extends BaseTypeNode {
  kind: TypeKind.Date;
}

export interface RegExpTypeNode extends BaseTypeNode {
  kind: TypeKind.RegExp;
}

export interface PromiseTypeNode extends BaseTypeNode {
  kind: TypeKind.Promise;
  innerType: TypeNode;
}

export interface OptionalTypeNode extends BaseTypeNode {
  kind: TypeKind.Optional;
  innerType: TypeNode;
}

/** Union of all type nodes */
export type TypeNode =
  | StringTypeNode
  | NumberTypeNode
  | BooleanTypeNode
  | NullTypeNode
  | UndefinedTypeNode
  | VoidTypeNode
  | BigIntTypeNode
  | SymbolTypeNode
  | NeverTypeNode
  | AnyTypeNode
  | UnknownTypeNode
  | LiteralTypeNode
  | ArrayTypeNode
  | TupleTypeNode
  | ObjectTypeNode
  | InterfaceTypeNode
  | ClassTypeNode
  | EnumTypeNode
  | UnionTypeNode
  | IntersectionTypeNode
  | TypeReferenceNode
  | FunctionTypeNode
  | RecordTypeNode
  | PartialTypeNode
  | RequiredTypeNode
  | PickTypeNode
  | OmitTypeNode
  | MapTypeNode
  | SetTypeNode
  | DateTypeNode
  | RegExpTypeNode
  | PromiseTypeNode
  | OptionalTypeNode;

/** Configuration options for mock generation */
export interface MockOptions {
  /** Path to the .ts file containing the type definition */
  filePath?: string;
  /** Override specific property values */
  overrides?: Record<string, unknown>;
  /** Custom generators for specific types */
  generators?: {
    string?: () => string;
    number?: () => number;
    boolean?: () => boolean;
    date?: () => Date;
  };
  /** Maximum depth for nested objects (default: 5) */
  maxDepth?: number;
  /** Number of items to generate for arrays (default: 2) */
  arrayLength?: number;
  /** Whether to include optional properties (default: true) */
  includeOptional?: boolean;
}

/** Resolved type map from a file */
export interface ResolvedTypes {
  [typeName: string]: TypeNode;
}

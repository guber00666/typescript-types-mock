# typescript-types-mock

> Generate mock objects from TypeScript type definitions at runtime using ts-morph.

## Installation

```bash
npm install typescript-types-mock
```

**Peer dependencies:** `typescript` (>=5.0.0)

## Quick Start

Given a file `types.ts`:

```typescript
export interface User {
  name: string;
  age: number;
  isActive: boolean;
  email: string;
}

export type Status = "active" | "inactive" | "pending";

export enum Color {
  Red = "RED",
  Green = "GREEN",
  Blue = "BLUE",
}
```

Generate mocks:

```typescript
import { createMockFromFile } from "typescript-types-mock";

const user = createMockFromFile("./types.ts", "User");
// => { name: "Lorem ipsum", age: 423, isActive: true, email: "Hello World" }

const status = createMockFromFile("./types.ts", "Status");
// => "active" (randomly picks one of the union members)

const color = createMockFromFile("./types.ts", "Color");
// => "RED" (randomly picks one of the enum members)
```

## API

### `createMockFromFile(filePath, typeName, options?)`

Creates a single mock object from a TypeScript type definition in a file.

```typescript
import { createMockFromFile } from "typescript-types-mock";

const user = createMockFromFile("./src/types.ts", "User", {
  overrides: { name: "John Doe" },
  generators: { string: () => "custom-value" },
});
```

### `createManyMocks(filePath, typeName, count, options?)`

Creates multiple mock objects.

```typescript
import { createManyMocks } from "typescript-types-mock";

const users = createManyMocks("./types.ts", "User", 10);
// => Array of 10 mock User objects
```

### `listTypes(filePath)`

Lists all available types in a TypeScript file.

```typescript
import { listTypes } from "typescript-types-mock";

const types = listTypes("./types.ts");
// => ["User", "Status", "Color", "Address", ...]
```

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `overrides` | `Record<string, unknown>` | `{}` | Override specific property values |
| `generators.string` | `() => string` | random | Custom string generator |
| `generators.number` | `() => number` | random | Custom number generator |
| `generators.boolean` | `() => boolean` | random | Custom boolean generator |
| `generators.date` | `() => Date` | random | Custom date generator |
| `maxDepth` | `number` | `5` | Maximum depth for nested objects |
| `arrayLength` | `number` | `2` | Number of items in generated arrays |
| `includeOptional` | `boolean` | `true` | Whether to include optional properties |

## Supported Types

### Primitives
- `string`, `number`, `boolean`, `bigint`, `symbol`
- `null`, `undefined`, `void`
- `any`, `unknown`

### Literal Types
- String literals: `"hello"`
- Number literals: `42`
- Boolean literals: `true`, `false`

### Composite Types
- **Interfaces**: `interface User { name: string }`
- **Type aliases**: `type Status = "active" | "inactive"`
- **Enums**: `enum Color { Red = "RED" }`
- **Classes**: `class Vehicle { make: string }`

### Complex Types
- **Arrays**: `string[]`, `Array<User>`
- **Tuples**: `[string, number]`
- **Unions**: `string | number`
- **Intersections**: `User & Timestamped`
- **Optional properties**: `bio?: string`

### Utility Types
- `Record<K, V>`
- `Partial<T>`
- `Required<T>`
- `Pick<T, K>`
- `Omit<T, K>`

### Built-in Types
- `Date`, `RegExp`, `Map<K, V>`, `Set<T>`
- `Promise<T>`
- Functions (returns no-op stub)

## Examples

### With Overrides

```typescript
const user = createMockFromFile("./types.ts", "User", {
  overrides: {
    name: "Alice",
    age: 30,
  },
});
// => { name: "Alice", age: 30, isActive: true, email: "Lorem ipsum" }
```

### With Custom Generators

```typescript
let counter = 0;
const user = createMockFromFile("./types.ts", "User", {
  generators: {
    string: () => `user-${++counter}`,
    number: () => 42,
    boolean: () => true,
  },
});
// => { name: "user-1", age: 42, isActive: true, email: "user-2" }
```

### Nested Interfaces

```typescript
// types.ts
interface Address { street: string; city: string; }
interface Company { name: string; address: Address; }

const company = createMockFromFile("./types.ts", "Company");
// => {
//   name: "Lorem ipsum",
//   address: { street: "Foo Bar", city: "Test Value" }
// }
```

### Inheritance

```typescript
// types.ts
interface User { name: string; age: number; }
interface Admin extends User { role: string; permissions: string[]; }

const admin = createMockFromFile("./types.ts", "Admin");
// => { name: "Lorem ipsum", age: 42, role: "Hello World", permissions: ["Foo Bar", "Test Value"] }
```

### Exclude Optional Properties

```typescript
const profile = createMockFromFile("./types.ts", "Profile", {
  includeOptional: false,
});
// Optional properties (bio?, avatar?) will not be included
```

### Generate Arrays of Mocks

```typescript
const users = createManyMocks("./types.ts", "User", 5, {
  arrayLength: 3,
  generators: { number: () => Math.floor(Math.random() * 100) },
});
// => Array of 5 User objects
```

## How It Works

1. **Parsing**: Uses [ts-morph](https://ts-morph.com/) (TypeScript Compiler API wrapper) to parse `.ts` source files and extract type information (interfaces, type aliases, enums, classes).

2. **Type Resolution**: Converts TypeScript AST nodes into an internal type representation (`TypeNode`), handling nested types, imports, generics, and utility types.

3. **Mock Generation**: Traverses the resolved type tree and generates realistic random values for each type node, with configurable generators, overrides, and depth limits.

## License

MIT

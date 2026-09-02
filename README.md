# typescript-types-mock

[![npm version](https://img.shields.io/npm/v/typescript-types-mock.svg)](https://www.npmjs.com/package/typescript-types-mock)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-7.0-blue.svg)](https://www.typescriptlang.org/)

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

## Browser Usage

The package works in browser environments via a pre-built JSON schema generated at build time.

### Step 1: Generate schema at build time

Use the CLI tool to extract type information into a JSON file:

```bash
npx typescript-types-mock generate ./src/types.ts -o ./src/types.schema.json
```

Or add it to your build script:

```json
{
  "scripts": {
    "build:schema": "typescript-types-mock generate ./src/types.ts -o ./public/types.schema.json --pretty"
  }
}
```

### Step 2: Import and use in browser code

```typescript
import schema from "./types.schema.json";
import { createMockContext } from "typescript-types-mock/browser";

const ctx = createMockContext(schema, { seed: 42 });
const user = ctx.mock("User");
const users = ctx.many("User", 10);
```

Or use the lower-level API:

```typescript
import schema from "./types.schema.json";
import { createMockFromSchema } from "typescript-types-mock/browser";

const user = createMockFromSchema(schema, "User", {
  overrides: { name: "Alice" },
});
```

### Browser API

The `/browser` entry point exports browser-safe functions:

- `createMockContext(schema, options?)` — caching context for fast repeated calls
- `createMockFromSchema(schema, typeName, options?)` — create a single mock
- `createManyMocksFromSchema(schema, typeName, count, options?)` — create multiple mocks
- `listTypesFromSchema(schema)` — list all available type names
- `BrowserTypeResolver` — low-level resolver wrapper
- `MockContextBase` — base class for custom contexts
- `RandomGenerator` — random value generator
- `createRouteResponse`, `createApiResponse`, `createPaginatedResponse` — Playwright helpers

## Playwright Integration

In Playwright tests (Node.js environment), use the main API directly:

```typescript
import { createMockFromFile, createRouteResponse } from "typescript-types-mock";
import { test, expect } from "@playwright/test";

test("mock API response", async ({ page }) => {
  await page.route("**/api/users", (route) => {
    const user = createMockFromFile("./types.ts", "User");
    route.fulfill(createRouteResponse(user));
  });

  await page.goto("/users");
  // Your test assertions...
});
```

With custom status and headers:

```typescript
await page.route("**/api/users", (route) => {
  const user = createMockFromFile("./types.ts", "User", {
    overrides: { role: "admin" },
  });
  route.fulfill(createRouteResponse(user, { status: 201 }));
});
```

API response wrapper:

```typescript
await page.route("**/api/users", (route) => {
  const user = createMockFromFile("./types.ts", "User");
  const response = createApiResponse(user);
  route.fulfill(createRouteResponse(response));
});
```

## CLI Reference

### `typescript-types-mock generate`

Generate a JSON type schema from a TypeScript file for browser usage.

**Usage:**
```bash
typescript-types-mock generate <input.ts> [options]
```

**Options:**
- `-o, --output <file>` — Output file path (default: `<input>.schema.json`)
- `--pretty` — Pretty-print JSON output (default: minified)
- `-h, --help` — Show help message

**Examples:**
```bash
# Generate schema with default output name
typescript-types-mock generate ./src/types.ts
# → creates ./src/types.schema.json

# Specify output path
typescript-types-mock generate ./src/types.ts -o ./public/types.schema.json

# Pretty-print for debugging
typescript-types-mock generate ./src/types.ts --pretty
```

## How It Works

1. **Parsing**: Uses [ts-morph](https://ts-morph.com/) (TypeScript Compiler API wrapper) to parse `.ts` source files and extract type information (interfaces, type aliases, enums, classes).

2. **Type Resolution**: Converts TypeScript AST nodes into an internal type representation (`TypeNode`), handling nested types, imports, generics, and utility types.

3. **Mock Generation**: Traverses the resolved type tree and generates realistic random values for each type node, with configurable generators, overrides, and depth limits.

## License

MIT

# typescript-types-mock

[![npm version](https://img.shields.io/npm/v/typescript-types-mock.svg)](https://www.npmjs.com/package/typescript-types-mock)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> Generate mock objects from TypeScript types for **Playwright** testing. Resolves types across local modules and npm packages.

## Installation

```bash
npm install -D typescript-types-mock ts-morph typescript
```

## Quick Start — Playwright

```typescript
// e2e/example.spec.ts
import { test, expect } from "@playwright/test";
import {
  createMockFromFile,
  createRouteResponse,
  createApiResponse,
} from "typescript-types-mock";
import path from "path";

const TYPES = path.resolve(__dirname, "../src/types.ts");

test("user profile page renders mocked data", async ({ page }) => {
  const user = createMockFromFile(TYPES, "User");

  await page.route("**/api/user", (route) => {
    route.fulfill(createRouteResponse(user));
  });

  await page.goto("/profile");
  await expect(page.getByText(user.name as string)).toBeVisible();
});
```

## API

### `createMockFromFile(filePath, typeName, options?)`

```typescript
const user = createMockFromFile("./types.ts", "User", { seed: 42 });
// => { name: "Alice Smith", age: 25, email: "alice@example.com", ... }
```

### `createManyMocks(filePath, typeName, count, options?)`

```typescript
const users = createManyMocks("./types.ts", "User", 5);
// => [{ name: "Alice Smith", ... }, { name: "Bob Johnson", ... }, ...]
```

### `listTypes(filePath)`

```typescript
const types = listTypes("./types.ts");
// => ["User", "Admin", "Product", ...]
```

### `MockContext` — caching for performance

Parse once, reuse resolved types across multiple calls.

```typescript
import { createMockContext } from "typescript-types-mock";

const ctx = createMockContext("./types.ts");
const user = ctx.mock("User");       // single mock
const users = ctx.many("User", 10);  // array of mocks
const types = ctx.listTypes();       // ["User", "Admin", ...]
```

## Playwright Helpers

### `createRouteResponse(body, options?)`

Create a Playwright-compatible `route.fulfill()` response:

```typescript
const user = createMockFromFile("./types.ts", "User");
const response = createRouteResponse(user);
// => { status: 200, contentType: "application/json", headers: {...}, body: "..." }

await page.route("**/api/user", (route) => {
  route.fulfill(response);
});

// Custom status:
route.fulfill(createRouteResponse(user, { status: 201 }));
```

### `createApiResponse(data, options?)`

Wrap data in a standard API response envelope:

```typescript
const envelope = createApiResponse(user);
// => { data: user, error: null, status: 200, timestamp: "..." }

// Error response:
createApiResponse(null, { status: 404, error: "Not found" });
```

### `createPaginatedResponse(items, options?)`

Paginated response with metadata:

```typescript
const items = createManyMocks("./types.ts", "Product", 10);
const page = createPaginatedResponse(items, { page: 1, pageSize: 10, total: 50 });
// => { data: [...], meta: { page: 1, pageSize: 10, total: 50, totalPages: 5 }, ... }
```

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `seed` | `number` | — | Deterministic generation (same seed = same output) |
| `overrides` | `Record<string, unknown>` | `{}` | Override property values (supports nested merge) |
| `generators.string` | `() => string` | random | Custom string generator |
| `generators.number` | `() => number` | random | Custom number generator |
| `generators.boolean` | `() => boolean` | random | Custom boolean generator |
| `generators.date` | `() => Date` | random | Custom date generator |
| `maxDepth` | `number` | `5` | Maximum depth for nested objects |
| `arrayLength` | `number` | `2` | Number of items in generated arrays |
| `includeOptional` | `boolean` | `true` | Whether to include optional properties |

## Supported Types

- **Primitives**: `string`, `number`, `boolean`, `bigint`, `null`, `undefined`
- **Literals**: `"hello"`, `42`, `true`
- **Enums**: `enum Color { Red = "RED" }`
- **Unions**: `"active" | "inactive"`
- **Intersections**: `User & Timestamped`
- **Arrays/Tuples**: `string[]`, `[number, string]`
- **Utility Types**: `Record<K,V>`, `Partial<T>`, `Required<T>`, `Pick<T,K>`, `Omit<T,K>`
- **Built-ins**: `Date`, `RegExp`, `Map<K,V>`, `Set<T>`, `Promise<T>`
- **Classes, Interfaces, Generics**

## Cross-Module Resolution

Types are resolved across imports automatically:

```typescript
// types/models.ts
export interface User { name: string; email: string; role: Role; }

// types/enums.ts
export type Role = "admin" | "user";

// types/index.ts
export { User } from "./models";
export { Role } from "./enums";

// In your Playwright test:
const user = createMockFromFile("./types/index.ts", "User");
// => role is correctly resolved as "admin" or "user"
```

### npm Package Types

Types from installed packages are resolved from `.d.ts` files:

```typescript
// consumer.ts
import { AxiosResponse } from "axios";
interface MyData { response: AxiosResponse; }

const data = createMockFromFile("./consumer.ts", "MyData");
```

## Playwright Patterns

### Mocking multiple endpoints

```typescript
import { test } from "@playwright/test";
import { createMockContext, createRouteResponse } from "typescript-types-mock";

test("dashboard loads", async ({ page }) => {
  const ctx = createMockContext("./types.ts");

  await page.route("**/api/user", (route) =>
    route.fulfill(createRouteResponse(ctx.mock("User")))
  );
  await page.route("**/api/products", (route) =>
    route.fulfill(createRouteResponse(ctx.many("Product", 5)))
  );

  await page.goto("/dashboard");
});
```

### Error scenarios

```typescript
await page.route("**/api/user/999", (route) => {
  route.fulfill(createRouteResponse(
    createApiResponse(null, { status: 404, error: "Not found" }),
    { status: 404 }
  ));
});
```

### Overrides with nested merge

```typescript
const order = createMockFromFile("./types.ts", "Order", {
  overrides: {
    id: "ORD-001",
    shippingAddress: { city: "Moscow" }, // merges, other fields generated
  },
});
```

### Deterministic tests

```typescript
const user = createMockFromFile("./types.ts", "User", { seed: 42 });
// Same seed → same output → stable assertions
```

## How It Works

1. **Parsing**: Uses [ts-morph](https://ts-morph.com/) to parse `.ts` files and extract type information.
2. **Dependency Resolution**: Follows `import`/`export` chains across local modules, re-exports, and npm packages.
3. **Type Resolution**: Converts TypeScript AST into an internal `TypeNode` representation.
4. **Mock Generation**: Generates realistic random values with configurable generators, overrides, and depth limits.

## License

MIT

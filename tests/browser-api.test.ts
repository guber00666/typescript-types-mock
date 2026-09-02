// @vitest-environment jsdom
/**
 * Tests for the browser-safe API (src/browser.ts).
 *
 * These tests verify that the browser entry point works correctly
 * with pre-built JSON schemas, without any Node.js dependencies.
 */

import { describe, it, expect } from "vitest";
import {
  BrowserTypeResolver,
  MockContextBase,
  MockGenerator,
  createMockFromSchema,
  createManyMocksFromSchema,
  listTypesFromSchema,
  createMockContext,
  createRouteResponse,
  createApiResponse,
  createPaginatedResponse,
} from "../src/browser.js";
import type { ResolvedTypes, TypeKind } from "../src/types/index.js";

// A hand-crafted schema matching the ResolvedTypes format
// (simulates what the CLI generate-schema tool would produce)
const testSchema: ResolvedTypes = {
  User: {
    kind: "interface" as TypeKind,
    name: "User",
    properties: [
      {
        name: "id",
        type: { kind: "string" as TypeKind },
        optional: false,
        readonly: false,
      },
      {
        name: "name",
        type: { kind: "string" as TypeKind },
        optional: false,
        readonly: false,
      },
      {
        name: "email",
        type: { kind: "string" as TypeKind },
        optional: false,
        readonly: false,
      },
      {
        name: "age",
        type: { kind: "number" as TypeKind },
        optional: false,
        readonly: false,
      },
      {
        name: "role",
        type: {
          kind: "union" as TypeKind,
          types: [
            { kind: "literal" as TypeKind, value: "admin" },
            { kind: "literal" as TypeKind, value: "user" },
            { kind: "literal" as TypeKind, value: "guest" },
          ],
        },
        optional: false,
        readonly: false,
      },
      {
        name: "bio",
        type: { kind: "string" as TypeKind },
        optional: true,
        readonly: false,
      },
    ],
    extends: [],
    typeParameters: [],
    typeParameterNames: [],
  },
  Status: {
    kind: "union" as TypeKind,
    types: [
      { kind: "literal" as TypeKind, value: "active" },
      { kind: "literal" as TypeKind, value: "inactive" },
      { kind: "literal" as TypeKind, value: "pending" },
    ],
  },
};

describe("BrowserTypeResolver", () => {
  it("should resolve all types from a schema", () => {
    const resolver = new BrowserTypeResolver(testSchema);
    const types = resolver.resolveAllTypes();
    expect(Object.keys(types)).toEqual(["User", "Status"]);
  });

  it("should resolve a single type by name", () => {
    const resolver = new BrowserTypeResolver(testSchema);
    const userType = resolver.resolveType("User");
    expect(userType).toBeDefined();
    expect(userType?.kind).toBe("interface");
  });

  it("should return undefined for non-existent type", () => {
    const resolver = new BrowserTypeResolver(testSchema);
    expect(resolver.resolveType("NonExistent")).toBeUndefined();
  });

  it("should have a virtual file path", () => {
    const resolver = new BrowserTypeResolver(testSchema);
    expect(resolver.filePath).toBe("<browser-schema>");

    const resolver2 = new BrowserTypeResolver(testSchema, "my-types.ts");
    expect(resolver2.filePath).toBe("my-types.ts");
  });
});

describe("createMockFromSchema", () => {
  it("should create a mock object from schema", () => {
    const user = createMockFromSchema(testSchema, "User", { seed: 42 });
    expect(user).toBeDefined();
    expect(typeof user).toBe("object");
    const u = user as Record<string, unknown>;
    expect(typeof u.id).toBe("string");
    expect(typeof u.name).toBe("string");
    expect(typeof u.email).toBe("string");
    expect(typeof u.age).toBe("number");
    expect(["admin", "user", "guest"]).toContain(u.role);
  });

  it("should create a mock for union type", () => {
    const status = createMockFromSchema(testSchema, "Status", { seed: 42 });
    expect(["active", "inactive", "pending"]).toContain(status);
  });

  it("should throw for non-existent type", () => {
    expect(() => createMockFromSchema(testSchema, "NonExistent")).toThrow(
      'Type "NonExistent" not found in schema'
    );
  });

  it("should support overrides", () => {
    const user = createMockFromSchema(testSchema, "User", {
      seed: 42,
      overrides: { name: "Alice", age: 30 },
    });
    const u = user as Record<string, unknown>;
    expect(u.name).toBe("Alice");
    expect(u.age).toBe(30);
  });
});

describe("createManyMocksFromSchema", () => {
  it("should create multiple mock objects", () => {
    const users = createManyMocksFromSchema(testSchema, "User", 5, { seed: 42 });
    expect(users).toHaveLength(5);
    users.forEach((u) => {
      expect(typeof (u as Record<string, unknown>).name).toBe("string");
    });
  });
});

describe("listTypesFromSchema", () => {
  it("should list all type names", () => {
    const types = listTypesFromSchema(testSchema);
    expect(types).toEqual(["User", "Status"]);
  });
});

describe("MockContextBase (browser)", () => {
  it("should work with BrowserTypeResolver", () => {
    const resolver = new BrowserTypeResolver(testSchema);
    const ctx = new MockContextBase(resolver, { seed: 42 });

    const user = ctx.mock("User");
    expect(user).toBeDefined();
    expect(typeof user).toBe("object");
  });

  it("should cache resolved types", () => {
    const resolver = new BrowserTypeResolver(testSchema);
    const ctx = new MockContextBase(resolver);

    const types1 = ctx.getResolvedTypes();
    const types2 = ctx.getResolvedTypes();
    expect(types1).toBe(types2); // same reference = cached
  });

  it("should list types", () => {
    const resolver = new BrowserTypeResolver(testSchema);
    const ctx = new MockContextBase(resolver);
    expect(ctx.listTypes()).toEqual(["User", "Status"]);
  });

  it("should create many mocks", () => {
    const resolver = new BrowserTypeResolver(testSchema);
    const ctx = new MockContextBase(resolver, { seed: 42 });
    const users = ctx.many("User", 3);
    expect(users).toHaveLength(3);
  });
});

describe("createMockContext (browser overload)", () => {
  it("should create context from schema directly", () => {
    const ctx = createMockContext(testSchema, { seed: 42 });
    const user = ctx.mock("User");
    expect(user).toBeDefined();
    expect(typeof (user as Record<string, unknown>).name).toBe("string");
  });
});

describe("Playwright helpers (browser)", () => {
  it("createRouteResponse should work", () => {
    const response = createRouteResponse({ name: "test" });
    expect(response.status).toBe(200);
    expect(response.body).toBe('{"name":"test"}');
  });

  it("createApiResponse should work", () => {
    const response = createApiResponse({ id: 1 });
    expect(response.data).toEqual({ id: 1 });
    expect(response.error).toBeNull();
    expect(response.status).toBe(200);
  });

  it("createPaginatedResponse should work", () => {
    const response = createPaginatedResponse([1, 2, 3], { total: 10, page: 1, pageSize: 3 });
    expect(response.data).toEqual([1, 2, 3]);
    expect(response.meta.totalPages).toBe(4);
  });
});

/**
 * Playwright integration tests.
 *
 * Verifies that the core mock generation + Playwright helpers
 * work together as expected for typical route interception scenarios.
 */

import { describe, it, expect } from "vitest";
import {
  createMockFromFile,
  createManyMocks,
  createMockContext,
  createRouteResponse,
  createApiResponse,
  createPaginatedResponse,
  listTypes,
} from "../src/index.js";
import path from "path";

const FIXTURES_PATH = path.resolve(__dirname, "fixtures/sample-types.ts");

describe("Playwright integration", () => {
  describe("createMockFromFile + createRouteResponse", () => {
    it("should produce a valid route fulfillment object", () => {
      const user = createMockFromFile(FIXTURES_PATH, "User") as Record<string, unknown>;
      const response = createRouteResponse(user);

      expect(response.status).toBe(200);
      expect(response.contentType).toBe("application/json");
      expect(response.headers["content-type"]).toBe("application/json");
      expect(typeof response.body).toBe("string");

      const parsed = JSON.parse(response.body);
      expect(parsed.name).toBe(user.name);
      expect(parsed.age).toBe(user.age);
      expect(parsed.email).toBe(user.email);
    });

    it("should support custom status codes", () => {
      const user = createMockFromFile(FIXTURES_PATH, "User");
      const response = createRouteResponse(user, { status: 201 });
      expect(response.status).toBe(201);
    });

    it("should support custom headers", () => {
      const user = createMockFromFile(FIXTURES_PATH, "User");
      const response = createRouteResponse(user, {
        headers: { "x-request-id": "test-123" },
      });
      expect(response.headers["x-request-id"]).toBe("test-123");
      expect(response.headers["content-type"]).toBe("application/json");
    });
  });

  describe("createManyMocks + createPaginatedResponse", () => {
    it("should produce a paginated response with items", () => {
      const users = createManyMocks(FIXTURES_PATH, "User", 5) as Record<string, unknown>[];
      const page = createPaginatedResponse(users, {
        page: 2,
        pageSize: 5,
        total: 20,
      });

      expect(page.data).toHaveLength(5);
      expect(page.meta.page).toBe(2);
      expect(page.meta.pageSize).toBe(5);
      expect(page.meta.total).toBe(20);
      expect(page.meta.totalPages).toBe(4);
      expect(page.status).toBe(200);
      expect(page.timestamp).toBeTruthy();
    });
  });

  describe("createMockFromFile + createApiResponse", () => {
    it("should wrap mock in API response envelope", () => {
      const user = createMockFromFile(FIXTURES_PATH, "User", { seed: 42 });
      const envelope = createApiResponse(user);

      expect(envelope.data).toEqual(user);
      expect(envelope.error).toBeNull();
      expect(envelope.status).toBe(200);
      expect(envelope.timestamp).toBeTruthy();
    });

    it("should support error responses", () => {
      const errorResponse = createApiResponse(null, {
        status: 404,
        error: "User not found",
      });

      expect(errorResponse.data).toBeNull();
      expect(errorResponse.error).toBe("User not found");
      expect(errorResponse.status).toBe(404);
    });
  });

  describe("MockContext + Playwright helpers", () => {
    it("should cache types and produce multiple route responses", () => {
      const ctx = createMockContext(FIXTURES_PATH);

      const userResponse = createRouteResponse(ctx.mock("User"));
      const profileResponse = createRouteResponse(ctx.mock("Profile"));
      const addressResponse = createRouteResponse(ctx.mock("Address"));

      expect(userResponse.status).toBe(200);
      expect(profileResponse.status).toBe(200);
      expect(addressResponse.status).toBe(200);

      // All should have valid JSON bodies
      expect(() => JSON.parse(userResponse.body)).not.toThrow();
      expect(() => JSON.parse(profileResponse.body)).not.toThrow();
      expect(() => JSON.parse(addressResponse.body)).not.toThrow();
    });

    it("should produce multiple mocks via ctx.many()", () => {
      const ctx = createMockContext(FIXTURES_PATH);
      const users = ctx.many("User", 3) as Record<string, unknown>[];
      const page = createPaginatedResponse(users);

      expect(page.data).toHaveLength(3);
      expect(page.meta.total).toBe(3);
    });
  });

  describe("listTypes", () => {
    it("should list all available types for route mocking", () => {
      const types = listTypes(FIXTURES_PATH);

      expect(types).toContain("User");
      expect(types).toContain("Profile");
      expect(types).toContain("Address");
      expect(types).toContain("Company");
    });
  });

  describe("deterministic generation with seed", () => {
    it("should produce identical route responses with same seed", () => {
      const user1 = createMockFromFile(FIXTURES_PATH, "User", { seed: 42 });
      const user2 = createMockFromFile(FIXTURES_PATH, "User", { seed: 42 });

      const response1 = createRouteResponse(user1);
      const response2 = createRouteResponse(user2);

      expect(response1.body).toBe(response2.body);
    });
  });
});

import { describe, it, expect } from "vitest";
import {
  createRouteResponse,
  createApiResponse,
  createPaginatedResponse,
  RandomGenerator,
} from "../src/index";

describe("Playwright Helpers", () => {
  describe("createRouteResponse", () => {
    it("should create default route response", () => {
      const body = { name: "Alice", age: 30 };
      const response = createRouteResponse(body);

      expect(response.status).toBe(200);
      expect(response.contentType).toBe("application/json");
      expect(JSON.parse(response.body)).toEqual(body);
      expect(response.headers["content-type"]).toBe("application/json");
    });

    it("should support custom status and headers", () => {
      const response = createRouteResponse({ error: "Not found" }, {
        status: 404,
        headers: { "x-request-id": "123" },
      });

      expect(response.status).toBe(404);
      expect(response.headers["x-request-id"]).toBe("123");
    });
  });

  describe("createApiResponse", () => {
    it("should wrap data in standard response envelope", () => {
      const user = { name: "Bob", age: 25 };
      const response = createApiResponse(user);

      expect(response.data).toEqual(user);
      expect(response.error).toBeNull();
      expect(response.status).toBe(200);
      expect(response.timestamp).toBeTruthy();
    });

    it("should support error responses", () => {
      const response = createApiResponse(null, { status: 500, error: "Server error" });

      expect(response.data).toBeNull();
      expect(response.error).toBe("Server error");
      expect(response.status).toBe(500);
    });
  });

  describe("createPaginatedResponse", () => {
    it("should create paginated response with metadata", () => {
      const items = [1, 2, 3];
      const response = createPaginatedResponse(items, { page: 2, pageSize: 3, total: 10 });

      expect(response.data).toEqual([1, 2, 3]);
      expect(response.meta.page).toBe(2);
      expect(response.meta.pageSize).toBe(3);
      expect(response.meta.total).toBe(10);
      expect(response.meta.totalPages).toBe(4);
      expect(response.status).toBe(200);
    });
  });
});

describe("Deterministic Seed", () => {
  it("should produce identical results with same seed", () => {
    const rng1 = new RandomGenerator(12345);
    const rng2 = new RandomGenerator(12345);

    for (let i = 0; i < 20; i++) {
      expect(rng1.number(0, 1000)).toBe(rng2.number(0, 1000));
    }
  });

  it("should produce different results with different seeds", () => {
    const rng1 = new RandomGenerator(100);
    const rng2 = new RandomGenerator(200);

    const vals1 = Array.from({ length: 10 }, () => rng1.number(0, 1000));
    const vals2 = Array.from({ length: 10 }, () => rng2.number(0, 1000));

    expect(vals1).not.toEqual(vals2);
  });

  it("should support UUID generation", () => {
    const rng = new RandomGenerator(42);
    const uuid = rng.uuid();

    // Should be a valid UUID-like format
    expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{4}[0-9a-f]{4}[0-9a-f]{0,4}$/);
  });

  it("should support email generation", () => {
    const rng = new RandomGenerator(42);
    const email = rng.email();

    expect(email).toContain("@");
    expect(email).toContain(".");
  });

  it("should support phone generation", () => {
    const rng = new RandomGenerator(42);
    const phone = rng.phone();

    expect(phone).toMatch(/^\+7/);
  });
});

describe("Property-Name-Aware Generation", () => {
  it("should return null for unrecognized property names", () => {
    const rng = new RandomGenerator(42);
    expect(rng.stringForProperty("randomField")).toBeNull();
  });

  it("should generate email for 'email' property", () => {
    const rng = new RandomGenerator(42);
    const result = rng.stringForProperty("email");

    expect(result).not.toBeNull();
    expect(result!).toContain("@");
  });

  it("should generate URL for 'url' property", () => {
    const rng = new RandomGenerator(42);
    const result = rng.stringForProperty("url");

    expect(result).not.toBeNull();
    expect(result!).toMatch(/^https:\/\//);
  });

  it("should generate UUID for 'id' property", () => {
    const rng = new RandomGenerator(42);
    const result = rng.stringForProperty("id");

    expect(result).not.toBeNull();
    expect(result!.length).toBeGreaterThan(10);
  });

  it("should generate name for 'name' property", () => {
    const rng = new RandomGenerator(42);
    const result = rng.stringForProperty("name");

    expect(result).not.toBeNull();
    expect(result!.split(" ").length).toBeGreaterThanOrEqual(2);
  });

  it("should be deterministic for same seed", () => {
    const rng1 = new RandomGenerator(42);
    const rng2 = new RandomGenerator(42);

    expect(rng1.stringForProperty("email")).toBe(rng2.stringForProperty("email"));
    expect(rng1.stringForProperty("url")).toBe(rng2.stringForProperty("url"));
    expect(rng1.stringForProperty("phone")).toBe(rng2.stringForProperty("phone"));
  });
});

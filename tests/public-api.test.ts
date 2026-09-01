import { describe, it, expect } from "vitest";
import {
  createMockFromFile,
  createManyMocks,
  listTypes,
} from "../src/index.js";
import path from "path";

const FIXTURES_PATH = path.resolve(__dirname, "fixtures/sample-types.ts");

describe("Public API", () => {
  describe("createMockFromFile", () => {
    it("should create a mock from a file", () => {
      const mock = createMockFromFile(FIXTURES_PATH, "User") as Record<string, unknown>;

      expect(mock).toBeDefined();
      expect(typeof mock.name).toBe("string");
      expect(typeof mock.age).toBe("number");
      expect(typeof mock.isActive).toBe("boolean");
      expect(typeof mock.email).toBe("string");
    });

    it("should accept options", () => {
      const mock = createMockFromFile(FIXTURES_PATH, "User", {
        overrides: { name: "Override Name" },
        generators: { number: () => 99 },
      }) as Record<string, unknown>;

      expect(mock.name).toBe("Override Name");
      expect(mock.age).toBe(99);
    });

    it("should throw for non-existent type", () => {
      expect(() =>
        createMockFromFile(FIXTURES_PATH, "NonExistent")
      ).toThrow();
    });

    it("should throw for non-existent file", () => {
      expect(() =>
        createMockFromFile("/non/existent/file.ts", "User")
      ).toThrow();
    });
  });

  describe("createManyMocks", () => {
    it("should create multiple mock objects", () => {
      const mocks = createManyMocks(FIXTURES_PATH, "User", 5) as Record<string, unknown>[];

      expect(mocks).toHaveLength(5);
      for (const mock of mocks) {
        expect(typeof mock.name).toBe("string");
        expect(typeof mock.age).toBe("number");
      }
    });

    it("should create an empty array for count 0", () => {
      const mocks = createManyMocks(FIXTURES_PATH, "User", 0);
      expect(mocks).toHaveLength(0);
    });
  });

  describe("listTypes", () => {
    it("should list all available types", () => {
      const types = listTypes(FIXTURES_PATH);

      expect(types).toContain("User");
      expect(types).toContain("Profile");
      expect(types).toContain("Address");
      expect(types).toContain("Company");
      expect(types).toContain("Admin");
      expect(types).toContain("Color");
      expect(types).toContain("HttpStatus");
      expect(types).toContain("BlogPost");
      expect(types).toContain("Status");
      expect(types).toContain("Priority");
    });

    it("should return unique type names", () => {
      const types = listTypes(FIXTURES_PATH);
      const unique = [...new Set(types)];
      expect(types.length).toBe(unique.length);
    });
  });
});

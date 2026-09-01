import { describe, it, expect } from "vitest";
import { TypeResolver } from "../src/core/type-resolver.js";
import { MockGenerator } from "../src/core/mock-generator.js";
import path from "path";

const FIXTURES_PATH = path.resolve(__dirname, "fixtures/sample-types.ts");

function createGenerator(options = {}) {
  const resolver = new TypeResolver(FIXTURES_PATH);
  const resolvedTypes = resolver.resolveAllTypes();
  return new MockGenerator(resolvedTypes, options);
}

describe("MockGenerator", () => {
  describe("simple interface", () => {
    it("should generate a mock for a simple interface", () => {
      const generator = createGenerator();
      const mock = generator.generate("User") as Record<string, unknown>;

      expect(mock).toBeDefined();
      expect(typeof mock.name).toBe("string");
      expect(typeof mock.age).toBe("number");
      expect(typeof mock.isActive).toBe("boolean");
      expect(typeof mock.email).toBe("string");
    });

    it("should generate different values on multiple calls", () => {
      const generator = createGenerator();
      const mock1 = generator.generate("User") as Record<string, unknown>;
      const mock2 = generator.generate("User") as Record<string, unknown>;

      // At least one property should differ (probabilistic, but very likely)
      const allSame =
        mock1.name === mock2.name &&
        mock1.age === mock2.age &&
        mock1.isActive === mock2.isActive &&
        mock1.email === mock2.email;

      // Run multiple times to reduce flakiness
      const mocks = Array.from({ length: 10 }, () =>
        generator.generate("User") as Record<string, unknown>
      );
      const names = new Set(mocks.map((m) => m.name));
      expect(names.size).toBeGreaterThan(1);
    });
  });

  describe("optional properties", () => {
    it("should include optional properties when includeOptional is true", () => {
      const generator = createGenerator({ includeOptional: true });
      // Run multiple times to check that optional properties appear at least once
      const hasBio = Array.from({ length: 20 }, () =>
        generator.generate("Profile") as Record<string, unknown>
      ).some((m) => "bio" in m);

      expect(hasBio).toBe(true);
    });

    it("should exclude optional properties when includeOptional is false", () => {
      const generator = createGenerator({ includeOptional: false });
      const mock = generator.generate("Profile") as Record<string, unknown>;

      expect(mock).toHaveProperty("username");
      expect(mock).toHaveProperty("followers");
      expect(mock).not.toHaveProperty("bio");
      expect(mock).not.toHaveProperty("avatar");
    });
  });

  describe("nested interfaces", () => {
    it("should generate nested objects", () => {
      const generator = createGenerator();
      const mock = generator.generate("Company") as Record<string, unknown>;

      expect(mock).toBeDefined();
      expect(typeof mock.name).toBe("string");
      expect(typeof mock.employees).toBe("number");

      const address = mock.address as Record<string, unknown>;
      expect(address).toBeDefined();
      expect(typeof address.street).toBe("string");
      expect(typeof address.city).toBe("string");
      expect(typeof address.country).toBe("string");
      expect(typeof address.zipCode).toBe("string");
    });
  });

  describe("extending interfaces", () => {
    it("should include parent properties", () => {
      const generator = createGenerator();
      const mock = generator.generate("Admin") as Record<string, unknown>;

      // Own properties
      expect(typeof mock.role).toBe("string");
      expect(Array.isArray(mock.permissions)).toBe(true);

      // Inherited from User
      expect(typeof mock.name).toBe("string");
      expect(typeof mock.age).toBe("number");
      expect(typeof mock.isActive).toBe("boolean");
    });
  });

  describe("enums", () => {
    it("should generate a valid enum value (string enum)", () => {
      const generator = createGenerator();
      const validValues = ["RED", "GREEN", "BLUE"];

      for (let i = 0; i < 20; i++) {
        const value = generator.generate("Color");
        expect(validValues).toContain(value);
      }
    });

    it("should generate a valid enum value (numeric enum)", () => {
      const generator = createGenerator();
      const validValues = [200, 404, 500];

      for (let i = 0; i < 20; i++) {
        const value = generator.generate("HttpStatus");
        expect(validValues).toContain(value);
      }
    });
  });

  describe("union types", () => {
    it("should generate a valid value from string literal union", () => {
      const generator = createGenerator();
      const validValues = ["active", "inactive", "pending"];

      for (let i = 0; i < 20; i++) {
        const value = generator.generate("Status");
        expect(validValues).toContain(value);
      }
    });

    it("should generate a valid value from number literal union", () => {
      const generator = createGenerator();
      const validValues = [1, 2, 3];

      for (let i = 0; i < 20; i++) {
        const value = generator.generate("Priority");
        expect(validValues).toContain(value);
      }
    });
  });

  describe("tuple types", () => {
    it("should generate a tuple with correct types", () => {
      const generator = createGenerator();
      const mock = generator.generate("Coordinate") as unknown[];

      expect(Array.isArray(mock)).toBe(true);
      expect(mock).toHaveLength(2);
      expect(typeof mock[0]).toBe("number");
      expect(typeof mock[1]).toBe("number");
    });

    it("should generate a named tuple with mixed types", () => {
      const generator = createGenerator();
      const mock = generator.generate("NamedValue") as unknown[];

      expect(mock).toHaveLength(3);
      expect(typeof mock[0]).toBe("string");
      expect(typeof mock[1]).toBe("number");
      expect(typeof mock[2]).toBe("boolean");
    });
  });

  describe("arrays", () => {
    it("should generate an array of strings", () => {
      const generator = createGenerator();
      const mock = generator.generate("StringList") as unknown[];

      expect(Array.isArray(mock)).toBe(true);
      expect(mock).toHaveLength(2); // default arrayLength
      for (const item of mock) {
        expect(typeof item).toBe("string");
      }
    });

    it("should respect custom arrayLength option", () => {
      const generator = createGenerator({ arrayLength: 5 });
      const mock = generator.generate("StringList") as unknown[];

      expect(mock).toHaveLength(5);
    });

    it("should generate array of complex objects", () => {
      const generator = createGenerator();
      const mock = generator.generate("UserList") as Record<string, unknown>[];

      expect(Array.isArray(mock)).toBe(true);
      for (const user of mock) {
        expect(typeof user.name).toBe("string");
        expect(typeof user.age).toBe("number");
      }
    });
  });

  describe("literal types", () => {
    it("should generate exact literal values", () => {
      const generator = createGenerator();
      const mock = generator.generate("Config") as Record<string, unknown>;

      expect(["development", "production", "test"]).toContain(mock.mode);
      expect([3, 5, 10]).toContain(mock.maxRetries);
      expect(mock.verbose).toBe(true);
    });
  });

  describe("overrides", () => {
    it("should apply overrides to generated mock", () => {
      const generator = createGenerator({
        overrides: { name: "John Doe", age: 30 },
      });
      const mock = generator.generate("User") as Record<string, unknown>;

      expect(mock.name).toBe("John Doe");
      expect(mock.age).toBe(30);
    });
  });

  describe("custom generators", () => {
    it("should use custom string generator", () => {
      const generator = createGenerator({
        generators: { string: () => "custom-value" },
      });
      const mock = generator.generate("User") as Record<string, unknown>;

      expect(mock.name).toBe("custom-value");
      expect(mock.email).toBe("custom-value");
    });

    it("should use custom number generator", () => {
      const generator = createGenerator({
        generators: { number: () => 42 },
      });
      const mock = generator.generate("User") as Record<string, unknown>;

      expect(mock.age).toBe(42);
    });

    it("should use custom boolean generator", () => {
      const generator = createGenerator({
        generators: { boolean: () => true },
      });
      const mock = generator.generate("User") as Record<string, unknown>;

      expect(mock.isActive).toBe(true);
    });
  });

  describe("complex types", () => {
    it("should generate a complex blog post", () => {
      const generator = createGenerator();
      const mock = generator.generate("BlogPost") as Record<string, unknown>;

      expect(typeof mock.id).toBe("string");
      expect(typeof mock.title).toBe("string");
      expect(typeof mock.content).toBe("string");
      expect(Array.isArray(mock.tags)).toBe(true);
      expect(["active", "inactive", "pending"]).toContain(mock.status);

      const author = mock.author as Record<string, unknown>;
      expect(typeof author.name).toBe("string");
      expect(typeof author.age).toBe("number");

      const metadata = mock.metadata as Record<string, unknown>;
      expect(typeof metadata.views).toBe("number");
      expect(typeof metadata.likes).toBe("number");
      expect(Array.isArray(metadata.comments)).toBe(true);
    });
  });

  describe("intersection types", () => {
    it("should merge properties from all intersected types", () => {
      const generator = createGenerator();
      const mock = generator.generate("TimestampedUser") as Record<string, unknown>;

      // From User
      expect(typeof mock.name).toBe("string");
      expect(typeof mock.age).toBe("number");

      // From Timestamped
      expect(typeof mock.createdAt).toBe("string");
      expect(typeof mock.updatedAt).toBe("string");
    });
  });

  describe("class types", () => {
    it("should generate a mock for a class", () => {
      const generator = createGenerator();
      const mock = generator.generate("Vehicle") as Record<string, unknown>;

      expect(typeof mock.make).toBe("string");
      expect(typeof mock.model).toBe("string");
      expect(typeof mock.year).toBe("number");
    });
  });

  describe("utility types", () => {
    it("should handle Record<string, User>", () => {
      const generator = createGenerator();
      const mock = generator.generate("UserMap") as Record<string, unknown>;

      expect(typeof mock).toBe("object");
      expect(mock).not.toBeNull();

      for (const value of Object.values(mock)) {
        const user = value as Record<string, unknown>;
        expect(typeof user.name).toBe("string");
        expect(typeof user.age).toBe("number");
      }
    });
  });

  describe("error handling", () => {
    it("should throw for non-existent type", () => {
      const generator = createGenerator();
      expect(() => generator.generate("NonExistent")).toThrow(
        'Type "NonExistent" not found'
      );
    });
  });
});

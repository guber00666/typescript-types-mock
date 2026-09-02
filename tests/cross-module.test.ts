import { describe, it, expect } from "vitest";
import { TypeResolver } from "../src/core/type-resolver.js";
import { MockGenerator } from "../src/core/mock-generator.js";
import { TypeKind } from "../src/types/index.js";
import path from "path";

const FIXTURES_PATH = path.resolve(__dirname, "fixtures/cross-module/types.ts");

describe("Cross-module type resolution", () => {
  let resolver: TypeResolver;

  beforeEach(() => {
    resolver = new TypeResolver(FIXTURES_PATH);
  });

  describe("resolveAllTypes — loads types from imported modules", () => {
    it("should resolve types from the entry file", () => {
      const types = resolver.resolveAllTypes();
      expect(types).toHaveProperty("Employee");
      expect(types).toHaveProperty("Office");
      expect(types).toHaveProperty("Project");
      expect(types).toHaveProperty("LocalType");
    });

    it("should resolve types imported from local modules", () => {
      const types = resolver.resolveAllTypes();
      // From ./models
      expect(types).toHaveProperty("Address");
      expect(types).toHaveProperty("Company");
      expect(types).toHaveProperty("Priority");
    });

    it("should resolve types from nested directories", () => {
      const types = resolver.resolveAllTypes();
      // From ./nested/deep-types
      expect(types).toHaveProperty("NestedConfig");
      expect(types).toHaveProperty("Environment");
    });

    it("should resolve types from re-export modules", () => {
      const types = resolver.resolveAllTypes();
      // Address is re-exported from ./reexport → ./models
      // It should still be available
      expect(types).toHaveProperty("Address");
    });

    it("should resolve types from circular dependencies without crashing", () => {
      const types = resolver.resolveAllTypes();
      expect(types).toHaveProperty("TypeA");
      expect(types).toHaveProperty("TypeB");
    });
  });

  describe("resolveType — finds types across modules", () => {
    it("should find a type from a dependency module", () => {
      const address = resolver.resolveType("Address");
      expect(address).toBeDefined();
      expect(address?.kind).toBe(TypeKind.Interface);
      if (address?.kind === TypeKind.Interface) {
        const propNames = address.properties.map((p) => p.name);
        expect(propNames).toContain("street");
        expect(propNames).toContain("city");
      }
    });

    it("should find a type from a nested directory", () => {
      const config = resolver.resolveType("NestedConfig");
      expect(config).toBeDefined();
      expect(config?.kind).toBe(TypeKind.Interface);
      if (config?.kind === TypeKind.Interface) {
        const propNames = config.properties.map((p) => p.name);
        expect(propNames).toContain("host");
        expect(propNames).toContain("port");
      }
    });

    it("should find a type alias from a dependency", () => {
      const priority = resolver.resolveType("Priority");
      expect(priority).toBeDefined();
      expect(priority?.kind).toBe(TypeKind.Union);
    });

    it("should return undefined for truly non-existent types", () => {
      const missing = resolver.resolveType("CompletelyMissingType");
      expect(missing).toBeUndefined();
    });
  });

  describe("MockGenerator — generates mocks with cross-module types", () => {
    it("should generate a mock for Employee with nested Address and Company", () => {
      const resolvedTypes = resolver.resolveAllTypes();
      const generator = new MockGenerator(resolvedTypes, {
        generators: {
          string: () => "test-value",
          number: () => 42,
          boolean: () => true,
        },
      });

      const mock = generator.generate("Employee") as Record<string, unknown>;

      // Primitive fields
      expect(mock.name).toBe("test-value");
      expect(mock.age).toBe(42);

      // Nested Company (from ./models)
      expect(mock.company).toBeDefined();
      const company = mock.company as Record<string, unknown>;
      expect(company.name).toBe("test-value");
      expect(company.employees).toBe(42);

      // Nested Company.address (Address from ./models)
      const companyAddress = company.address as Record<string, unknown>;
      expect(companyAddress).toBeDefined();
      expect(companyAddress.street).toBe("test-value");
      expect(companyAddress.city).toBe("test-value");

      // Direct Address property
      expect(mock.address).toBeDefined();
      const address = mock.address as Record<string, unknown>;
      expect(address.street).toBe("test-value");
      expect(address.city).toBe("test-value");
    });

    it("should generate a mock for Office with re-exported and nested types", () => {
      const resolvedTypes = resolver.resolveAllTypes();
      const generator = new MockGenerator(resolvedTypes, {
        generators: {
          string: () => "office-val",
          number: () => 99,
          boolean: () => false,
        },
      });

      const mock = generator.generate("Office") as Record<string, unknown>;

      // location is ReExportedAddress (from ./reexport → ./models)
      const location = mock.location as Record<string, unknown>;
      expect(location).toBeDefined();
      expect(location.street).toBe("office-val");
      expect(location.city).toBe("office-val");

      // config is NestedConfig (from ./nested/deep-types)
      const config = mock.config as Record<string, unknown>;
      expect(config).toBeDefined();
      expect(config.host).toBe("office-val");
      expect(config.port).toBe(99);
      expect(config.debug).toBe(false);
    });

    it("should generate mocks for circular dependency types without infinite loops", () => {
      const resolvedTypes = resolver.resolveAllTypes();
      const generator = new MockGenerator(resolvedTypes, {
        generators: {
          string: () => "circ-val",
          number: () => 7,
          boolean: () => true,
        },
      });

      // Should not throw or hang
      const mockA = generator.generate("TypeA") as Record<string, unknown>;
      expect(mockA.name).toBe("circ-val");

      const mockB = generator.generate("TypeB") as Record<string, unknown>;
      expect(mockB.id).toBe(7);
    });

    it("should generate mock for Project (uses TypeA from circular)", () => {
      const resolvedTypes = resolver.resolveAllTypes();
      const generator = new MockGenerator(resolvedTypes, {
        generators: {
          string: () => "proj-val",
          number: () => 3,
          boolean: () => true,
        },
      });

      const mock = generator.generate("Project") as Record<string, unknown>;
      expect(mock.title).toBe("proj-val");

      const owner = mock.owner as Record<string, unknown>;
      expect(owner).toBeDefined();
      expect(owner.name).toBe("proj-val");
    });
  });

  describe("Backward compatibility — files without imports still work", () => {
    it("should work with the original sample-types fixture", () => {
      const samplePath = path.resolve(__dirname, "fixtures/sample-types.ts");
      const sampleResolver = new TypeResolver(samplePath);
      const types = sampleResolver.resolveAllTypes();

      // All original types should still be present
      expect(types).toHaveProperty("User");
      expect(types).toHaveProperty("Profile");
      expect(types).toHaveProperty("Address");
      expect(types).toHaveProperty("Company");
      expect(types).toHaveProperty("Admin");
      expect(types).toHaveProperty("Color");
      expect(types).toHaveProperty("HttpStatus");
      expect(types).toHaveProperty("BlogPost");
      expect(types).toHaveProperty("Vehicle");
    });
  });
});

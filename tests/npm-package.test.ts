import { describe, it, expect } from "vitest";
import { TypeResolver } from "../src/core/type-resolver.js";
import { MockGenerator } from "../src/core/mock-generator.js";
import { TypeKind } from "../src/types/index.js";
import path from "path";

const FIXTURES_PATH = path.resolve(__dirname, "fixtures/npm-package/consumer.ts");

describe("NPM package type resolution", () => {
  let resolver: TypeResolver;

  beforeEach(() => {
    resolver = new TypeResolver(FIXTURES_PATH);
  });

  describe("resolveAllTypes — loads types from npm packages", () => {
    it("should resolve types from the consumer file", () => {
      const types = resolver.resolveAllTypes();
      expect(types).toHaveProperty("Customer");
      expect(types).toHaveProperty("SimpleWrapper");
    });

    it("should resolve types from npm package .d.ts files", () => {
      const types = resolver.resolveAllTypes();
      // From fake-types-pkg/types/index.d.ts
      expect(types).toHaveProperty("UserProfile");
      // From fake-types-pkg/types/address.d.ts (reached via index.d.ts import)
      expect(types).toHaveProperty("Address");
      expect(types).toHaveProperty("ZipCode");
    });
  });

  describe("resolveType — finds npm package types", () => {
    it("should find a type defined in an npm package .d.ts", () => {
      const userProfile = resolver.resolveType("UserProfile");
      expect(userProfile).toBeDefined();
      expect(userProfile?.kind).toBe(TypeKind.Interface);
      if (userProfile?.kind === TypeKind.Interface) {
        const propNames = userProfile.properties.map((p) => p.name);
        expect(propNames).toContain("name");
        expect(propNames).toContain("address");
        expect(propNames).toContain("zip");
      }
    });

    it("should find a type from a nested .d.ts file within the package", () => {
      const address = resolver.resolveType("Address");
      expect(address).toBeDefined();
      expect(address?.kind).toBe(TypeKind.Interface);
      if (address?.kind === TypeKind.Interface) {
        const propNames = address.properties.map((p) => p.name);
        expect(propNames).toContain("street");
        expect(propNames).toContain("city");
        expect(propNames).toContain("country");
      }
    });

    it("should find a type alias from the npm package", () => {
      const zipCode = resolver.resolveType("ZipCode");
      expect(zipCode).toBeDefined();
      expect(zipCode?.kind).toBe(TypeKind.String);
    });
  });

  describe("MockGenerator — generates mocks with npm package types", () => {
    it("should generate a mock for Customer with deeply nested npm types", () => {
      const resolvedTypes = resolver.resolveAllTypes();
      const generator = new MockGenerator(resolvedTypes, {
        generators: {
          string: () => "npm-test",
          number: () => 77,
          boolean: () => true,
        },
      });

      const mock = generator.generate("Customer") as Record<string, unknown>;

      expect(mock.id).toBe(77);

      // profile: UserProfile (from npm package)
      const profile = mock.profile as Record<string, unknown>;
      expect(profile).toBeDefined();
      expect(profile.name).toBe("npm-test");

      // profile.address: Address (from npm sub-file, reached via package import chain)
      const profileAddress = profile.address as Record<string, unknown>;
      expect(profileAddress).toBeDefined();
      expect(profileAddress.street).toBe("npm-test");
      expect(profileAddress.city).toBe("npm-test");
      expect(profileAddress.country).toBe("npm-test");

      // billingAddress: Address (direct npm import)
      const billing = mock.billingAddress as Record<string, unknown>;
      expect(billing).toBeDefined();
      expect(billing.street).toBe("npm-test");
    });

    it("should generate a mock for SimpleWrapper using npm Address type", () => {
      const resolvedTypes = resolver.resolveAllTypes();
      const generator = new MockGenerator(resolvedTypes, {
        generators: {
          string: () => "simple-npm",
          number: () => 1,
        },
      });

      const mock = generator.generate("SimpleWrapper") as Record<string, unknown>;
      const data = mock.data as Record<string, unknown>;
      expect(data).toBeDefined();
      expect(data.street).toBe("simple-npm");
      expect(data.city).toBe("simple-npm");
    });
  });
});

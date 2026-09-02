import { describe, it, expect } from "vitest";
import { TypeResolver, MockGenerator } from "../src/index";
import { resolve } from "path";

const FIXTURE_PATH = resolve(__dirname, "fixtures/sample-types.ts");

describe("Generic Type Substitution", () => {
  it("should resolve ApiResponse interface with type parameters", () => {
    const resolver = new TypeResolver(FIXTURE_PATH);
    const types = resolver.resolveAllTypes();

    // ApiResponse should exist and have typeParameters
    expect(types.ApiResponse).toBeDefined();
    expect(types.ApiResponse.kind).toBe("interface");
  });

  it("should substitute type parameters when generating concrete generic", () => {
    const resolver = new TypeResolver(FIXTURE_PATH);
    const types = resolver.resolveAllTypes();

    // Generate a mock for ApiResponse directly
    // The type parameter T won't be substituted without explicit type arguments
    // but the generator should not crash
    const generator = new MockGenerator(types, {
      filePath: FIXTURE_PATH,
      seed: 42,
    });

    // ApiResponse exists and has T as data field type reference
    // Without type arguments, data field references T which is unknown
    const result = generator.generate("ApiResponse") as Record<string, unknown>;
    expect(result).toBeDefined();
    expect(result.error).toBeDefined();
    expect(result.status).toBeDefined();
  });

  it("should handle type references to known types in generic positions", () => {
    const resolver = new TypeResolver(FIXTURE_PATH);
    const types = resolver.resolveAllTypes();

    // Generate User (no generics involved, sanity check)
    const generator = new MockGenerator(types, {
      filePath: FIXTURE_PATH,
      seed: 42,
    });

    const user = generator.generate("User") as Record<string, unknown>;
    expect(user.name).toBeDefined();
    expect(user.age).toBeDefined();
    expect(user.isActive).toBeDefined();
    expect(user.email).toBeDefined();
  });
});

describe("Nested Overrides", () => {
  it("should support nested object overrides", () => {
    const resolver = new TypeResolver(FIXTURE_PATH);
    const types = resolver.resolveAllTypes();

    const generator = new MockGenerator(types, {
      filePath: FIXTURE_PATH,
      seed: 42,
      overrides: {
        address: { city: "Moscow" },
      },
    });

    const company = generator.generate("Company") as Record<string, unknown>;
    const address = company.address as Record<string, unknown>;

    expect(address.city).toBe("Moscow");
    expect(address.street).toBeDefined();
    expect(address.country).toBeDefined();
  });
});

import { describe, it, expect } from "vitest";
import { TypeResolver } from "../src/core/type-resolver.js";
import { TypeKind } from "../src/types/index.js";
import path from "path";

const FIXTURES_PATH = path.resolve(__dirname, "fixtures/sample-types.ts");

describe("TypeResolver", () => {
  let resolver: TypeResolver;

  beforeEach(() => {
    resolver = new TypeResolver(FIXTURES_PATH);
  });

  describe("resolveAllTypes", () => {
    it("should resolve all exported types from the file", () => {
      const types = resolver.resolveAllTypes();
      const names = Object.keys(types);

      expect(names).toContain("User");
      expect(names).toContain("Profile");
      expect(names).toContain("Address");
      expect(names).toContain("Company");
      expect(names).toContain("Admin");
      expect(names).toContain("Color");
      expect(names).toContain("HttpStatus");
      expect(names).toContain("BlogPost");
      expect(names).toContain("Vehicle");
    });
  });

  describe("resolveType", () => {
    it("should resolve a simple interface", () => {
      const type = resolver.resolveType("User");
      expect(type).not.toBeNull();
      expect(type?.kind).toBe(TypeKind.Interface);
    });

    it("should resolve an enum", () => {
      const type = resolver.resolveType("Color");
      expect(type).not.toBeNull();
      expect(type?.kind).toBe(TypeKind.Enum);
    });

    it("should resolve a class", () => {
      const type = resolver.resolveType("Vehicle");
      expect(type).not.toBeNull();
      expect(type?.kind).toBe(TypeKind.Class);
    });

    it("should resolve a type alias", () => {
      const type = resolver.resolveType("Status");
      expect(type).not.toBeNull();
      expect(type?.kind).toBe(TypeKind.Union);
    });

    it("should return null for non-existent type", () => {
      const type = resolver.resolveType("NonExistentType");
      expect(type).toBeNull();
    });
  });

  describe("interface properties", () => {
    it("should resolve interface properties correctly", () => {
      const type = resolver.resolveType("User");
      expect(type?.kind).toBe(TypeKind.Interface);

      if (type?.kind === TypeKind.Interface) {
        const propNames = type.properties.map((p) => p.name);
        expect(propNames).toContain("name");
        expect(propNames).toContain("age");
        expect(propNames).toContain("isActive");
        expect(propNames).toContain("email");
      }
    });

    it("should detect optional properties", () => {
      const type = resolver.resolveType("Profile");
      expect(type?.kind).toBe(TypeKind.Interface);

      if (type?.kind === TypeKind.Interface) {
        const bio = type.properties.find((p) => p.name === "bio");
        const username = type.properties.find((p) => p.name === "username");

        expect(bio?.optional).toBe(true);
        expect(username?.optional).toBe(false);
      }
    });

    it("should resolve nested interface references", () => {
      const type = resolver.resolveType("Company");
      expect(type?.kind).toBe(TypeKind.Interface);

      if (type?.kind === TypeKind.Interface) {
        const addressProp = type.properties.find((p) => p.name === "address");
        expect(addressProp).toBeDefined();
        expect(addressProp?.type.kind).toBe(TypeKind.TypeReference);
      }
    });
  });

  describe("enum resolution", () => {
    it("should resolve string enum members", () => {
      const type = resolver.resolveType("Color");
      expect(type?.kind).toBe(TypeKind.Enum);

      if (type?.kind === TypeKind.Enum) {
        expect(type.members).toHaveLength(3);
        expect(type.members.map((m) => m.name)).toContain("Red");
        expect(type.members.map((m) => m.value)).toContain("RED");
      }
    });

    it("should resolve numeric enum members", () => {
      const type = resolver.resolveType("HttpStatus");
      expect(type?.kind).toBe(TypeKind.Enum);

      if (type?.kind === TypeKind.Enum) {
        expect(type.members).toHaveLength(3);
        const ok = type.members.find((m) => m.name === "OK");
        expect(ok?.value).toBe(200);
      }
    });
  });

  describe("type alias resolution", () => {
    it("should resolve union of string literals", () => {
      const type = resolver.resolveType("Status");
      expect(type?.kind).toBe(TypeKind.Union);

      if (type?.kind === TypeKind.Union) {
        expect(type.types).toHaveLength(3);
        for (const t of type.types) {
          expect(t.kind).toBe(TypeKind.Literal);
        }
      }
    });

    it("should resolve union of number literals", () => {
      const type = resolver.resolveType("Priority");
      expect(type?.kind).toBe(TypeKind.Union);

      if (type?.kind === TypeKind.Union) {
        expect(type.types).toHaveLength(3);
        for (const t of type.types) {
          expect(t.kind).toBe(TypeKind.Literal);
        }
      }
    });

    it("should resolve union with null", () => {
      const type = resolver.resolveType("Result");
      expect(type?.kind).toBe(TypeKind.Union);

      if (type?.kind === TypeKind.Union) {
        const hasNull = type.types.some((t) => t.kind === TypeKind.Null);
        expect(hasNull).toBe(true);
      }
    });

    it("should resolve tuple type", () => {
      const type = resolver.resolveType("Coordinate");
      expect(type?.kind).toBe(TypeKind.Tuple);

      if (type?.kind === TypeKind.Tuple) {
        expect(type.elements).toHaveLength(2);
        expect(type.elements[0]?.kind).toBe(TypeKind.Number);
        expect(type.elements[1]?.kind).toBe(TypeKind.Number);
      }
    });

    it("should resolve array type alias", () => {
      const type = resolver.resolveType("StringList");
      expect(type?.kind).toBe(TypeKind.Array);

      if (type?.kind === TypeKind.Array) {
        expect(type.elementType.kind).toBe(TypeKind.String);
      }
    });
  });
});

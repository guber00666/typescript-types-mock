import { describe, it, expect } from "vitest";
import * as nativeBinding from "../index.js";
import * as path from "path";

const FIXTURES_PATH = path.resolve(
  __dirname,
  "fixtures/node-modules-test/consumer.ts",
);

describe("NPM package resolution (native NAPI)", () => {
  it("should list types including those from node_modules", () => {
    const types = nativeBinding.listTypes(FIXTURES_PATH);
    expect(types).toContain("MyData");
    expect(types).toContain("ExternalResponse");
    expect(types).toContain("Status");
    // Scoped package types
    expect(types).toContain("Config");
    expect(types).toContain("Logger");
  });

  it("should generate mock with resolved npm package types", () => {
    const mock = nativeBinding.createMockFromFile(FIXTURES_PATH, "MyData", {
      seed: 42,
    }) as Record<string, unknown>;

    // localField from consumer.ts — should be a string, not <unresolved:>
    expect(typeof mock.localField).toBe("string");

    // response: ExternalResponse (from fake-package in node_modules)
    const response = mock.response as Record<string, unknown>;
    expect(response).toBeDefined();
    expect(typeof response.data).toBe("string");
    expect(typeof response.status).toBe("number");
    expect(response.headers).toBeDefined();

    // status: Status union type (from fake-package)
    expect(["success", "error"]).toContain(mock.status);

    // config: Config (from scoped package @my-org/types)
    const config = mock.config as Record<string, unknown>;
    expect(config).toBeDefined();
    expect(typeof config.apiUrl).toBe("string");
    expect(typeof config.timeout).toBe("number");

    // logger: Logger (from @my-org/types/lib/logger.d.ts, resolved via re-export)
    const logger = mock.logger as Record<string, unknown>;
    expect(logger).toBeDefined();
    expect(["debug", "info", "warn", "error"]).toContain(logger.level);
    expect(typeof logger.prefix).toBe("string");
  });

  it("should NOT produce <unresolved:> placeholders for npm types", () => {
    const mock = nativeBinding.createMockFromFile(FIXTURES_PATH, "MyData") as Record<string, unknown>;
    const json = JSON.stringify(mock);
    expect(json).not.toContain("<unresolved:");
  });
});
/**
 * Browser-safe example demonstrating how to use typescript-types-mock
 * in browser environments with a pre-built JSON schema.
 *
 * Prerequisites:
 *   1. Run: npm run build
 *   2. Run: node dist/cli/generate-schema.js examples/types.ts -o examples/types.schema.json --pretty
 *   3. This file can then be bundled with Vite/Webpack/etc. for browser use
 */

import schema from "./types.schema.json";
import {
  createMockContext,
  createMockFromSchema,
  createManyMocksFromSchema,
  listTypesFromSchema,
  createRouteResponse,
  createApiResponse,
} from "../src/browser.js";

console.log("═══════════════════════════════════════════════════");
console.log("  typescript-types-mock — Browser Example");
console.log("═══════════════════════════════════════════════════\n");

// ─────────────────────────────────────────────────
// 1. Simple mock from schema
// ─────────────────────────────────────────────────
console.log("1️⃣  Simple mock from schema:\n");
const user = createMockFromSchema(schema, "User", { seed: 42 });
console.log(JSON.stringify(user, null, 2));

// ─────────────────────────────────────────────────
// 2. List all available types
// ─────────────────────────────────────────────────
console.log("\n2️⃣  Available types in schema:\n");
const types = listTypesFromSchema(schema);
console.log(`  ${types.join(", ")}`);

// ─────────────────────────────────────────────────
// 3. MockContext (recommended for performance)
// ─────────────────────────────────────────────────
console.log("\n3️⃣  MockContext (caching):\n");
const ctx = createMockContext(schema, { seed: 42 });

const ctxUser = ctx.mock("User");
console.log("User:", JSON.stringify(ctxUser));

const ctxProduct = ctx.mock("Product");
console.log("Product:", JSON.stringify(ctxProduct));

const ctxOrder = ctx.mock("Order");
console.log("Order (first 100 chars):", JSON.stringify(ctxOrder).slice(0, 100) + "...");

// ─────────────────────────────────────────────────
// 4. Multiple mocks
// ─────────────────────────────────────────────────
console.log("\n4️⃣  Multiple mocks (3 users):\n");
const users = createManyMocksFromSchema(schema, "User", 3, { seed: 42 });
users.forEach((u, i) => {
  const user = u as Record<string, unknown>;
  console.log(`  User ${i + 1}: ${user.name} (${user.email})`);
});

// ─────────────────────────────────────────────────
// 5. Overrides
// ─────────────────────────────────────────────────
console.log("\n5️⃣  Overrides:\n");
const customUser = createMockFromSchema(schema, "User", {
  seed: 42,
  overrides: {
    name: "Alice Johnson",
    email: "alice@example.com",
    role: "admin",
  },
});
console.log(JSON.stringify(customUser, null, 2));

// ─────────────────────────────────────────────────
// 6. Nested overrides (merge)
// ─────────────────────────────────────────────────
console.log("\n6️⃣  Nested overrides:\n");
const order = createMockFromSchema(schema, "Order", {
  seed: 42,
  overrides: {
    id: "ORD-2024-001",
    user: { name: "Bob Smith", role: "customer" },
    status: "shipped",
  },
});
console.log(JSON.stringify(order, null, 2));

// ─────────────────────────────────────────────────
// 7. Deterministic generation (seed)
// ─────────────────────────────────────────────────
console.log("\n7️⃣  Deterministic generation:\n");
const user1 = createMockFromSchema(schema, "User", { seed: 123 });
const user2 = createMockFromSchema(schema, "User", { seed: 123 });
console.log("Same seed → identical?", JSON.stringify(user1) === JSON.stringify(user2) ? "✅ Yes" : "❌ No");

const user3 = createMockFromSchema(schema, "User", { seed: 456 });
console.log("Different seed → different?", JSON.stringify(user1) !== JSON.stringify(user3) ? "✅ Yes" : "❌ No");

// ─────────────────────────────────────────────────
// 8. Enum mock
// ─────────────────────────────────────────────────
console.log("\n8️⃣  Enum mock (PaymentMethod):\n");
for (let i = 0; i < 5; i++) {
  const payment = createMockFromSchema(schema, "PaymentMethod", { seed: i * 10 });
  console.log(`  Attempt ${i + 1}: ${payment}`);
}

// ─────────────────────────────────────────────────
// 9. Playwright helpers (browser-safe)
// ─────────────────────────────────────────────────
console.log("\n9️⃣  Playwright helpers:\n");

const mockUser = createMockFromSchema(schema, "User", { seed: 42 });

// Route response
const routeResponse = createRouteResponse(mockUser);
console.log("Route response:", JSON.stringify(routeResponse, null, 2));

// API response wrapper
const apiResponse = createApiResponse(mockUser);
console.log("\nAPI response wrapper:", JSON.stringify(apiResponse, null, 2));

// Error response
const errorResponse = createApiResponse(null, {
  status: 404,
  error: "User not found",
});
console.log("\nError response:", JSON.stringify(errorResponse, null, 2));

// ─────────────────────────────────────────────────
// 10. Custom generators
// ─────────────────────────────────────────────────
console.log("\n🔟  Custom generators:\n");
let counter = 0;
const customGenUser = createMockFromSchema(schema, "User", {
  seed: 42,
  generators: {
    string: () => `custom-${++counter}`,
    number: () => 999,
    boolean: () => true,
  },
});
console.log(JSON.stringify(customGenUser, null, 2));

// ─────────────────────────────────────────────────
// 11. JSON-safe output
// ─────────────────────────────────────────────────
console.log("\n1️⃣1️⃣  JSON-safe output:\n");
const safeUser = createMockFromSchema(schema, "User", { seed: 42 });
const serialized = JSON.stringify(safeUser);
console.log("JSON.stringify works?", serialized ? "✅ Yes" : "❌ No");
console.log("Size:", (serialized.length / 1024).toFixed(2), "KB");

// ─────────────────────────────────────────────────
// 12. Performance comparison
// ─────────────────────────────────────────────────
console.log("\n1️⃣2️⃣  Performance (1000 mocks):\n");

// Without context (recreates resolver each time)
const startNoCtx = performance.now();
for (let i = 0; i < 1000; i++) {
  createMockFromSchema(schema, "User", { seed: i });
}
const endNoCtx = performance.now();
console.log(`  Without context: ${(endNoCtx - startNoCtx).toFixed(1)}ms`);

// With context (reuses resolver)
const perfCtx = createMockContext(schema);
const startCtx = performance.now();
for (let i = 0; i < 1000; i++) {
  perfCtx.mock("User", { seed: i });
}
const endCtx = performance.now();
console.log(`  With context: ${(endCtx - startCtx).toFixed(1)}ms`);
console.log(`  Speedup: ${((endNoCtx - startNoCtx) / (endCtx - startCtx)).toFixed(1)}x`);

console.log("\n═══════════════════════════════════════════════════");
console.log("  ✅ Browser example completed successfully!");
console.log("═══════════════════════════════════════════════════");

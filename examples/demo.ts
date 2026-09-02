import {
  createMockFromFile,
  createManyMocks,
  listTypes,
  createMockContext,
  createRouteResponse,
  createApiResponse,
  createPaginatedResponse,
} from "../src/index.js";
import path from "path";

const TYPES_FILE = path.resolve(import.meta.dirname, "types.ts");

console.log("═══════════════════════════════════════════════════");
console.log("  typescript-types-mock — Примеры использования");
console.log("═══════════════════════════════════════════════════\n");

// ─────────────────────────────────────────────────
// 1. Простой мок интерфейса (семантические генераторы)
// ─────────────────────────────────────────────────
console.log("1️⃣  Простой мок — User (с семантическими генераторами):\n");
const user = createMockFromFile(TYPES_FILE, "User");
console.log(JSON.stringify(user, null, 2));
// → email содержит "@", name = "Имя Фамилия"

// ─────────────────────────────────────────────────
// 2. Детерминированная генерация (seed)
// ─────────────────────────────────────────────────
console.log("\n2️⃣  Детерминированная генерация (seed: 42):\n");
const user1 = createMockFromFile(TYPES_FILE, "User", { seed: 42 });
const user2 = createMockFromFile(TYPES_FILE, "User", { seed: 42 });
console.log("User #1:", JSON.stringify(user1));
console.log("User #2:", JSON.stringify(user2));
console.log("Идентичны?", JSON.stringify(user1) === JSON.stringify(user2) ? "✅ Да" : "❌ Нет");

// ─────────────────────────────────────────────────
// 3. Мок с overrides + nested merge
// ─────────────────────────────────────────────────
console.log("\n3️⃣  Мок с overrides (вложенный merge):\n");
const order = createMockFromFile(TYPES_FILE, "Order", {
  seed: 42,
  overrides: {
    id: "ORD-2024-001",
    totalAmount: 149.99,
    shippingAddress: { city: "Москва" }, // merge: остальные поля генерируются
  },
  arrayLength: 2,
});
console.log(JSON.stringify(order, null, 2));

// ─────────────────────────────────────────────────
// 4. MockContext (кэширование для производительности)
// ─────────────────────────────────────────────────
console.log("\n4️⃣  MockContext (кэширование типов):\n");
const ctx = createMockContext(TYPES_FILE);
const ctxUser = ctx.mock("User");
const ctxOrder = ctx.mock("Order");
console.log("User from context:", JSON.stringify(ctxUser));
console.log("Order from context:", JSON.stringify(ctxOrder));
console.log(`Доступные типы: ${ctx.listTypes().join(", ")}`);

// ─────────────────────────────────────────────────
// 5. Enum мок
// ─────────────────────────────────────────────────
console.log("\n5️⃣  Enum мок — PaymentMethod:\n");
for (let i = 0; i < 5; i++) {
  const payment = createMockFromFile(TYPES_FILE, "PaymentMethod", { seed: i * 100 });
  console.log(`  Попытка ${i + 1}: ${payment}`);
}

// ─────────────────────────────────────────────────
// 6. Массив моков (createManyMocks)
// ─────────────────────────────────────────────────
console.log("\n6️⃣  Массив из 3-х продуктов:\n");
const products = createManyMocks(TYPES_FILE, "Product", 3, { seed: 42 });
console.log(JSON.stringify(products, null, 2));

// ─────────────────────────────────────────────────
// 7. Playwright хелперы
// ─────────────────────────────────────────────────
console.log("\n7️⃣  Playwright helpers:\n");

// route.fulfill() response
const mockUser = createMockFromFile(TYPES_FILE, "User", { seed: 42 });
const routeResponse = createRouteResponse(mockUser);
console.log("Route response:", JSON.stringify(routeResponse, null, 2));

// API response wrapper
const apiResponse = createApiResponse(mockUser);
console.log("\nAPI response wrapper:", JSON.stringify(apiResponse, null, 2));

// Paginated response
const mockProducts = createManyMocks(TYPES_FILE, "Product", 5, { seed: 42 });
const paginatedResponse = createPaginatedResponse(mockProducts, {
  page: 1,
  pageSize: 5,
  total: 50,
});
console.log("\nPaginated response meta:", JSON.stringify(paginatedResponse.meta));

// ─────────────────────────────────────────────────
// 8. JSON-safe output (Date, Map, Set, BigInt → безопасные значения)
// ─────────────────────────────────────────────────
console.log("\n8️⃣  JSON-safe output:\n");
const safeUser = createMockFromFile(TYPES_FILE, "User", { seed: 42 });
const serialized = JSON.stringify(safeUser);
console.log("JSON.stringify работает?", serialized ? "✅ Да" : "❌ Нет");
console.log("Результат:", serialized);

// ─────────────────────────────────────────────────
// 9. Список всех доступных типов
// ─────────────────────────────────────────────────
console.log("\n9️⃣  Все доступные типы в файле:\n");
const types = listTypes(TYPES_FILE);
console.log(`  ${types.join(", ")}`);

console.log("\n═══════════════════════════════════════════════════");
console.log("  ✅ Все примеры выполнены успешно!");
console.log("═══════════════════════════════════════════════════");

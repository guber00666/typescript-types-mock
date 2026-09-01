import { createMockFromFile, createManyMocks, listTypes } from "../src/index.js";
import path from "path";

const TYPES_FILE = path.resolve(import.meta.dirname, "types.ts");

console.log("═══════════════════════════════════════════════════");
console.log("  typescript-types-mock — Примеры использования");
console.log("═══════════════════════════════════════════════════\n");

// ─────────────────────────────────────────────────
// 1. Простой мок интерфейса
// ─────────────────────────────────────────────────
console.log("1️⃣  Простой мок — User:\n");
const user = createMockFromFile(TYPES_FILE, "User");
console.log(JSON.stringify(user, null, 2));

// ─────────────────────────────────────────────────
// 2. Мок с overrides (переопределение полей)
// ─────────────────────────────────────────────────
console.log("\n2️⃣  Мок с overrides:\n");
const customUser = createMockFromFile(TYPES_FILE, "User", {
  overrides: {
    name: "Иван Петров",
    email: "ivan@example.com",
    role: "admin",
  },
});
console.log(JSON.stringify(customUser, null, 2));

// ─────────────────────────────────────────────────
// 3. Мок с кастомными генераторами
// ─────────────────────────────────────────────────
console.log("\n3️⃣  Мок с кастомными генераторами:\n");
let idCounter = 0;
const generatedUser = createMockFromFile(TYPES_FILE, "User", {
  generators: {
    string: () => `generated-string-${++idCounter}`,
    number: () => Math.floor(Math.random() * 100),
    boolean: () => true,
  },
});
console.log(JSON.stringify(generatedUser, null, 2));

// ─────────────────────────────────────────────────
// 4. Enum мок
// ─────────────────────────────────────────────────
console.log("\n4️⃣  Enum мок — PaymentMethod:\n");
for (let i = 0; i < 5; i++) {
  const payment = createMockFromFile(TYPES_FILE, "PaymentMethod");
  console.log(`  Попытка ${i + 1}: ${payment}`);
}

// ─────────────────────────────────────────────────
// 5. Union type мок
// ─────────────────────────────────────────────────
console.log("\n5️⃣  Union type — UserRole:\n");
for (let i = 0; i < 5; i++) {
  const role = createMockFromFile(TYPES_FILE, "UserRole");
  console.log(`  Попытка ${i + 1}: ${role}`);
}

// ─────────────────────────────────────────────────
// 6. Массив моков (createManyMocks)
// ─────────────────────────────────────────────────
console.log("\n6️⃣  Массив из 3-х продуктов:\n");
const products = createManyMocks(TYPES_FILE, "Product", 3);
console.log(JSON.stringify(products, null, 2));

// ─────────────────────────────────────────────────
// 7. Сложный вложенный тип — Order
// ─────────────────────────────────────────────────
console.log("\n7️⃣  Сложный тип — Order (вложенные объекты):\n");
const order = createMockFromFile(TYPES_FILE, "Order", {
  overrides: {
    id: "ORD-2024-001",
    totalAmount: 149.99,
  },
  arrayLength: 2,
});
console.log(JSON.stringify(order, null, 2));

// ─────────────────────────────────────────────────
// 8. Исключение опциональных полей
// ─────────────────────────────────────────────────
console.log("\n8️⃣  Без опциональных полей (includeOptional: false):\n");
const userNoOptional = createMockFromFile(TYPES_FILE, "User", {
  includeOptional: false,
});
console.log(JSON.stringify(userNoOptional, null, 2));

// ─────────────────────────────────────────────────
// 9. Список всех доступных типов
// ─────────────────────────────────────────────────
console.log("\n9️⃣  Все доступные типы в файле:\n");
const types = listTypes(TYPES_FILE);
console.log(`  ${types.join(", ")}`);

console.log("\n═══════════════════════════════════════════════════");
console.log("  ✅ Все примеры выполнены успешно!");
console.log("═══════════════════════════════════════════════════");

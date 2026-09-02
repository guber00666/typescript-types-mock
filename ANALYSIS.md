# Анализ модуля `typescript-types-mock` для генерации моков в Playwright тестах

> Дата: 2026-09-02
> Статус: План доработки

---

## Описание модуля

`typescript-types-mock` — библиотека для генерации мок-объектов из TypeScript типов на этапе выполнения (runtime). Использует `ts-morph` для парсинга `.ts` файлов и извлечения информации о типах (интерфейсы, type aliases, enums, classes).

### Архитектура

```
src/
├── index.ts                  # Публичный API: createMockFromFile, createManyMocks, listTypes
├── core/
│   ├── type-resolver.ts      # Парсинг .ts файлов через ts-morph → TypeNode
│   └── mock-generator.ts     # Генерация mock-значений из TypeNode
├── types/
│   └── index.ts              # Внутренние типы (TypeKind enum, TypeNode union, MockOptions)
└── utils/
    └── random.ts             # Утилиты для генерации случайных значений
```

### Публичный API

```typescript
createMockFromFile(filePath: string, typeName: string, options?: MockOptions): unknown
createManyMocks(filePath: string, typeName: string, count: number, options?: MockOptions): unknown[]
listTypes(filePath: string): string[]
```

### Зависимости

- `ts-morph ^25.0.0` (runtime dependency)
- `typescript >=5.0.0` (peer dependency)

### Сборка

- Rslib (ESM + CJS output)
- Vitest для тестирования

---

## 🔴 Критические проблемы

### 1. Отсутствие поддержки импортов из других файлов

`TypeResolver` парсит только один файл через `project.addSourceFileAtPath(filePath)`. В реальных проектах типы распределены по множеству файлов:

```ts
// types.ts
import { User } from './user';
export interface Order {
  user: User; // ← User НЕ будет разрешён, останется как TypeReference
}
```

**Файл:** `src/core/type-resolver.ts`, строка 51
**Проблема:** `addSourceFileAtPath` добавляет только один файл в Project, импорты не подтягиваются.

### 2. Недетерминированность — flaky тесты

Нет поддержки `seed` для генератора случайных чисел. Каждый запуск даёт разные данные. В Playwright e2e-тестировании это приводит к нестабильным тестам.

**Файл:** `src/utils/random.ts`
**Проблема:** Все функции используют `Math.random()` без возможности задать seed.

### 3. Несериализуемые типы

Генерируются несериализуемые в JSON значения:
- `BigInt` → `TypeError` при `JSON.stringify`
- `Symbol` → игнорируется при сериализации
- `Map`, `Set` → не передаются через Playwright serialization boundary
- `Promise.resolve()` → не нужен в синхронных моках
- `RegExp` → `/mock-regex/g` не сериализуется

**Файл:** `src/core/mock-generator.ts`, строки 74-78, 148-155
**Проблема:** Playwright `route.fulfill()`, `page.evaluate()` требуют JSON-safe значения.

### 4. `visitedTypes` не сбрасывается между вызовами `generate()`

```typescript
// mock-generator.ts:33
private visitedTypes: Set<string> = new Set();
```

При повторном вызове `generator.generate("User")` на том же экземпляре `MockGenerator`, второй вызов вернёт `{}` из-за проверки на строке 230:

```typescript
if (this.visitedTypes.has(node.name) && depth > 1) {
  return {};
}
```

`visitedTypes` никогда не очищается после завершения `generate()`.

### 5. Каждый вызов `createMockFromFile` заново инициализирует ts-morph Project

```typescript
// index.ts:44
const resolver = new TypeResolver(filePath);
const resolvedTypes = resolver.resolveAllTypes();
```

Нет кэширования. При каждом вызове:
- Создаётся новый `Project` (тяжёлая операция)
- Парсится весь файл заново
- Накладные расходы ~500-700ms на вызов

### 6. Проблемы при использовании rspack/Rsbuild в проекте-потребителе

#### 6.1. .ts файлы типов не копируются в dist

```ts
// В source коде:
const user = createMockFromFile('./types.ts', 'User');

// После сборки rspack: ./types.ts НЕ скопирован в dist/
// Error: ENOENT: no such file or directory
```

rspack/Rsbuild по умолчанию не копирует `.ts` файлы в output — только JS, CSS, и assets.

#### 6.2. Относительные пути ломаются

rspack меняет структуру output директории. Относительные пути к `.ts` файлам становятся невалидными после сборки.

#### 6.3. ts-morph несовместим с browser target

```js
// rspack.config.js
{ target: 'web' }
// → Error: Module not found: Can't resolve 'fs' in 'ts-morph'
```

`ts-morph` использует Node.js API (`fs`, `path`). При browser target сборка падает.

#### 6.4. Dynamic imports и code splitting

rspack может разбивать код на chunks. Если `createMockFromFile` вызывается динамически, chunk с `.ts` файлами может не загрузиться.

#### 6.5. Virtual modules и path aliases

```ts
// rspack.config.js
{ resolve: { alias: { '@types': './src/shared/types' } } }

// Работает в rspack:
import { User } from '@/types/user';
// НЕ работает в ts-morph:
const mock = createMockFromFile('@/types/user.ts', 'User');
```

ts-morph работает напрямую с файловой системой и не знает о rspack aliases и tsconfig paths.

#### 6.6. Production mode оптимизации

В production mode rspack может удалять «неиспользуемые» экспорты через tree-shaking, включая типы, используемые только в runtime.

#### 6.7. Кэш rspack

rspack использует агрессивное кэширование. При изменении `.ts` файлов типов, кэш может не инвалидироваться.

#### 6.8. SSR / Serverless

Если Playwright тесты запускаются против SSR-приложения, server bundle может не содержать `.ts` файлов. Runtime parsing невозможен в serverless environment.

---

## 🟡 Серьёзные проблемы

### 7. Нерелевантные строковые значения

Строки генерируются из фиксированного пула:
```ts
["Lorem ipsum", "Hello World", "Foo Bar", "Test Value", "Sample Data", ...]
```

Для Playwright e2e-тестов, проверяющих UI, нужны семантические данные:
- `email` → email-подобная строка (`user@example.com`)
- `url` → URL (`https://example.com`)
- `name` → имя (`Иван Петров`)
- `phone` → телефон (`+7 999 123-45-67`)

### 8. Плоские overrides — нет вложенных переопределений

```ts
// Сейчас НЕ работает:
createMockFromFile("...", "User", {
  overrides: { "address.city": "Moscow" }
  // или
  overrides: { address: { city: "Moscow" } }
});
```

**Файл:** `src/core/mock-generator.ts`, строки 216-218
**Проблема:** Override применяется только к свойствам верхнего уровня.

### 9. Generic-типы не разворачиваются

```ts
type UserResponse = ApiResponse<User>;
```

При генерации `UserResponse` — type alias резолвится в `TypeReference { name: "ApiResponse", typeArguments: [User] }`, но `generateTypeReference` (строка 122, 295-325) не подставляет type arguments в generic-шаблон.

### 10. `extends` имена содержат дженерики

```typescript
// type-resolver.ts:141
const extendsExprs = iface.getExtends().map((e) => e.getText());
// Результат: "BaseType<Arg>" вместо "BaseType"
```

При поиске `resolvedTypes["BaseType<Arg>"]` — тип не находится.

### 11. Отсутствует поддержка продвинутых TypeScript конструкций

- `keyof T` → резолвится в `Any`
- Mapped types `{ [K in keyof T]: ... }` → пустой объект `{ properties: [] }`
- Function types → пустые параметры `[]`
- Conditional types → не поддерживаются
- Template literal types → не поддерживаются

---

## 🟢 Проблемы средней важности

### 12. Нет Playwright-специфичной интеграции

- Нет хелперов для `route.fulfill()` (JSON-ответ с заголовками)
- Нет Playwright test fixtures
- Нет генерации API-ответов с обёрткой (status, headers, body)

### 13. `Promise` генерирует реальный `Promise.resolve()`

```typescript
// mock-generator.ts:155
return Promise.resolve(this.generateValue(node.innerType, depth + 1));
```

Для API-моков нужен resolved value, не обёрнутый в Promise.

### 14. Классы генерируются как простые объекты

Нет экземпляров, методов, прототипов. Классы — это плоские объекты с public properties.

### 15. Относительные пути непредсказуемы

`filePath` зависит от CWD, который в Playwright может меняться при параллельном запуске тестов.

---

## 📌 План работ по доработке

### Фаза 1: Исправление критических багов

| # | Задача | Файл | Описание |
|---|--------|------|----------|
| 1.1 | Сброс `visitedTypes` | `mock-generator.ts:230` | Сбрасывать `visitedTypes` в начале `generate()` или сделать его локальным для вызова |
| 1.2 | Исправить `extends` с дженериками | `type-resolver.ts:141` | Парсить имя из extends-выражения, отбрасывая generic-аргументы: `"BaseType<Arg>" → "BaseType"` |
| 1.3 | Корректная сериализация | `mock-generator.ts:74-155` | `BigInt` → `number/string`, `Symbol` → `string`, `RegExp` → `string`, `Promise<T>` → `T` |
| 1.4 | Валидация `filePath` | `type-resolver.ts:33-51` | Приводить к абсолютному пути через `path.resolve()`, валидировать существование файла, чёткие ошибки |

### Фаза 2: Производительность

| # | Задача | Описание |
|---|--------|----------|
| 2.1 | Кэширование `TypeResolver` | Создать `MockFactory` / `createMockContext()` — один Project на файл, переиспользование между вызовами |
| 2.2 | Ленивое разрешение типов | Резолвить только запрошенный тип, а не все типы в файле через `resolveAllTypes()` |
| 2.3 | Кэш моков | Опциональный кэш сгенерированных моков по ключу (typeName + options hash) |

### Фаза 3: Детерминированность и качество данных

| # | Задача | Описание |
|---|--------|----------|
| 3.1 | Seed-генератор | Добавить опцию `seed: number` в `MockOptions` для воспроизводимых тестов. Использовать PRNG с seed (например, `seedrandom` или `mulberry32`) |
| 3.2 | Имя-зависимые генераторы | Инспектировать имя свойства: `email` → email, `id` → UUID, `url` → URL, `phone` → телефон, `date`/`At` → ISO-дата |
| 3.3 | Faker интеграция | Опциональная peer-dependency на `@faker-js/faker` или собственные семантические генераторы |
| 3.4 | Диапазонные ограничения | Опция `constraints: { age: { min: 18, max: 65 }, name: { pattern: "..." } }` |

### Фаза 4: Расширение поддержки типов

| # | Задача | Описание |
|---|--------|----------|
| 4.1 | Разворачивание дженериков | Подстановка type arguments в generic-интерфейсы: `ApiResponse<User>` → полное развёртывание с подстановкой `T → User` |
| 4.2 | Поддержка `keyof` | Резолвить `keyof T` в union of literal key types |
| 4.3 | Mapped types | Полная поддержка `{ [K in keyof T]: V }` |
| 4.4 | Условные типы | Базовая поддержка `T extends U ? X : Y` |
| 4.5 | Template literal types | ``type Email = `${string}@${string}` `` |
| 4.6 | Cross-file imports | Резолвить импортированные типы из других `.ts` файлов через `addSourceFilesFromTsConfig` или рекурсивный обход импортов |
| 4.7 | Re-exports / barrel files | Обработка `export { type X } from './module'` |

### Фаза 5: API и DX для Playwright

| # | Задача | Описание |
|---|--------|----------|
| 5.1 | Вложенные overrides | Dot-notation: `{ "address.city": "Moscow" }` или deep merge: `{ address: { city: "Moscow" } }` |
| 5.2 | JSON-safe генерация | Опция `jsonSafe: true` — только JSON-сериализуемые значения (без Map, Set, Symbol, BigInt, RegExp, Promise) |
| 5.3 | Playwright route helper | `createMockRoute(page, url, typeName, options)` — хелпер для `route.fulfill({ json: ... })` |
| 5.4 | Playwright fixture | `test.extend<{ mockUser: User }>()` — интеграция с Playwright test fixtures |
| 5.5 | Генерация API-ответов | `createApiResponse(typeName, data, status)` — обёртка для REST-ответов `{ data, status, error }` |
| 5.6 | Типизированный результат | `createMockFromFile<T>(...): T` — generic возвращаемый тип для type-safety |

### Фаза 6: Интеграция со сборщиками (rspack / webpack / vite)

| # | Задача | Описание |
|---|--------|----------|
| 6.1 | Build-time кодогенерация | Плагин для rspack/webpack/vite, который на этапе сборки генерирует JSON-схемы типов или фабрики моков, устраняя runtime-парсинг |
| 6.2 | rspack loader для .ts типов | Custom loader/rule, который помечает `.ts` файлы типов как `asset/resource` и копирует их в output |
| 6.3 | Абсолютные пути и path mapping | Автоматическое разрешение `@/types/user.ts` → `./src/types/user.ts` через tsconfig `paths` |
| 6.4 | Virtual filesystem | Использовать memfs для работы в browser-like окружении без прямого доступа к FS |
| 6.5 | Pre-compiled mock factories | CLI-утилита или build-step: парсит типы → генерирует `mocks.generated.ts` с готовыми фабриками без ts-morph в runtime |
| 6.6 | rspack/webpack plugin | `new TypesMockPlugin({ types: ['./src/types/**/*.ts'] })` — автоматическая генерация моков на этапе сборки |
| 6.7 | Dev server middleware | Для rspack dev server: middleware, отдающий моки по HTTP без runtime-парсинга |
| 6.8 | Documentation: bundler setup | Гайд по настройке rspack.config.js / rsbuild.config.ts для работы с модулем |

### Фаза 7: Тестирование и документация

| # | Задача | Описание |
|---|--------|----------|
| 7.1 | Тесты на edge cases | Circular references, deep nesting, все utility types, empty interfaces |
| 7.2 | Playwright-пример | Полноценный пример проекта с Playwright + typescript-types-mock |
| 7.3 | rspack-пример | Пример проекта с rspack + typescript-types-mock + Playwright |
| 7.4 | Best practices guide | Документация: паттерны, антипаттерны, troubleshooting |
| 7.5 | Benchmark | Сравнение производительности: runtime vs build-time, с/без кэша |

---

## Приоритизация

### Высший приоритет (без этого модуль малопригоден для Playwright)

- **1.1** — Сброс `visitedTypes` (сломанные моки при повторных вызовах)
- **1.2** — Исправить `extends` с дженериками
- **1.3** — Корректная сериализация (BigInt crash)
- **2.1** — Кэширование (производительность)
- **3.1** — Seed (детерминированность)
- **5.2** — JSON-safe mode
- **6.1/6.5** — Build-time кодогенерация (решает проблемы с bundlers)

### Высокий приоритет

- **4.1** — Разворачивание дженериков
- **4.6** — Cross-file imports
- **5.1** — Вложенные overrides
- **5.3** — Playwright route helper
- **5.6** — Типизированный результат
- **6.2** — rspack loader
- **6.3** — Path mapping

### Средний приоритет

- **3.2** — Имя-зависимые генераторы
- **3.3** — Faker интеграция
- **5.4** — Playwright fixture
- **5.5** — API response wrapper
- **6.6/6.7** — rspack plugin, dev middleware
- **7.2/7.3** — Примеры

### Низкий приоритет

- **4.2–4.5** — keyof, mapped, conditional, template types
- **4.7** — Re-exports
- **6.4** — Virtual filesystem

---

## Рекомендуемая стратегия для rspack/Rsbuild проектов

### Краткосрочное решение (workaround)

1. Настроить rspack copy plugin для `.ts` файлов типов
2. Использовать абсолютные пути через `path.resolve(__dirname, '...')`
3. Добавлять `.ts` файлы в assets вручную

### Долгосрочное решение (Фаза 6.1 / 6.5)

Перейти на **build-time кодогенерацию**:

```ts
// build-time: rspack plugin парсит типы и генерирует:
// mocks.generated.ts
export function createMockUser(seed?: number): User {
  return { id: uuid(seed), name: fakerName(seed), ... };
}

// runtime: в тестах используем без парсинга
import { createMockUser } from './mocks.generated';
const user = createMockUser(42); // детерминированно, быстро
```

**Преимущества:**
- ✅ Работает с любым bundler (rspack, webpack, vite, esbuild)
- ✅ Не требует runtime-доступа к `.ts` файлам
- ✅ ~100x быстрее (нет парсинга ts-morph)
- ✅ Полностью детерминированно (seed)
- ✅ JSON-safe по умолчанию
- ✅ Нет зависимости от ts-morph в production bundle

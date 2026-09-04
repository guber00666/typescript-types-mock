# План миграции typescript-types-mock на Go

> ⚠️ **Этот план НЕ сохраняет совместимость с React+Playwright.** Go-бинарник нельзя импортировать как npm-пакет.
>
> **Основной план (сохраняет совместимость):** → [`RUST_NAPI_PLAN.md`](./RUST_NAPI_PLAN.md)
> (Rust + napi-rs: npm-пакет с тем же API, ускорение 10-50x)
>
> Этот файл — альтернативный план для случая, если нужен standalone CLI на Go.

## Целевой результат

Go-библиотека (`go-types-mock`) + CLI-утилита, которая:
- Парсит `.ts`/`.tsx` файлы и извлекает информацию о типах
- Генерирует JSON-совместимые mock-объекты из TypeScript-типов
- Поддержывает Playwright route interception (HTTP-хелперы)
- Работает как библиотека (`import "github.com/.../go-types-mock"`) и как CLI (`go-types-mock --file types.ts --type User`)

---

## Архитектура Go-проекта

```
go-types-mock/
├── cmd/
│   └── go-types-mock/          # CLI entrypoint
│       └── main.go
├── internal/
│   ├── parser/                 # Парсинг TypeScript в AST
│   │   ├── lexer.go            # Лексер (токенизация TS)
│   │   ├── parser.go           # Рекурсивный десцент-парсер
│   │   ├── ast.go              # AST-узлы TypeScript
│   │   └── parser_test.go
│   ├── resolver/               # Резолвинг типов
│   │   ├── resolver.go         # TypeResolver (парсинг → TypeNode)
│   │   ├── imports.go          # Резолвинг import/export цепочек
│   │   ├── npm.go              # Резолвинг npm-пакетов (.d.ts)
│   │   ├── generics.go         # Подстановка generic-параметров
│   │   └── resolver_test.go
│   ├── types/                  # Внутреннее представление типов
│   │   └── types.go            # TypeKind, TypeNode, ResolvedTypes
│   ├── generator/              # Генерация mock-значений
│   │   ├── generator.go        # MockGenerator
│   │   ├── primitives.go       # string, number, boolean, ...
│   │   ├── complex.go          # interface, class, enum, union, ...
│   │   ├── utilities.go        # Partial, Required, Pick, Omit, Record
│   │   └── generator_test.go
│   ├── context/                # Кэширующий контекст
│   │   ├── context.go          # MockContext
│   │   └── context_test.go
│   ├── random/                 # PRNG + semantic generators
│   │   ├── random.go           # RandomGenerator (mulberry32)
│   │   ├── semantic.go         # email, url, phone, uuid, name
│   │   └── random_test.go
│   └── helpers/                # HTTP/Playwright helpers
│       ├── response.go         # RouteResponse, ApiResponse, PaginatedResponse
│       └── response_test.go
├── testdata/                   # Фикстуры (копия tests/fixtures/)
│   ├── sample-types.ts
│   ├── cross-module/
│   └── npm-package/
├── go.mod
├── go.sum
├── README.md
├── LICENSE
└── Makefile
```

---

## Пошаговый план

### Этап 1: Инициализация проекта и типы

**Файлы:** `go.mod`, `internal/types/types.go`

- [ ] **1.1** `go mod init github.com/<user>/go-types-mock`
- [ ] **1.2** Определить `TypeKind` как Go `const` + `iota` (31 значение)
- [ ] **1.3** Определить `TypeNode` как `interface{}` с методами или tagged struct:
  ```go
  type TypeKind int
  const (
      KindString TypeKind = iota
      KindNumber
      KindBoolean
      // ... все 31 вид
  )

  type TypeNode struct {
      Kind       TypeKind
      Name       string          // для Interface, Class, Enum, TypeReference
      Value      interface{}     // для Literal
      Properties []PropertyNode  // для Interface, Class, Object
      Elements   []TypeNode      // для Tuple, Union, Intersection
      ElementType *TypeNode      // для Array, Set
      InnerType  *TypeNode       // для Partial, Required, Promise
      Members    []EnumMember    // для Enum
      Extends    []string        // для Interface, Class
      TypeParams []TypeNode      // для Interface (generic)
      TypeParamNames []string    // для Interface
      TypeArgs   []TypeNode      // для TypeReference
      Keys       []string        // для Pick, Omit
      KeyType    *TypeNode       // для Record, Map
      ValueType  *TypeNode       // для Record, Map
      Optional   bool            // для Optional
      Parameters []FuncParam     // для Function
      ReturnType *TypeNode       // для Function
  }
  ```
- [ ] **1.4** Определить вспомогательные структуры:
  ```go
  type PropertyNode struct {
      Name     string
      Type     TypeNode
      Optional bool
      ReadOnly bool
  }
  type EnumMember struct {
      Name  string
      Value interface{} // string или float64
  }
  type ResolvedTypes map[string]TypeNode
  ```
- [ ] **1.5** Определить `MockOptions`:
  ```go
  type MockOptions struct {
      Seed            *int64
      Overrides       map[string]interface{}
      Generators      CustomGenerators
      MaxDepth        int     // default: 5
      ArrayLength     int     // default: 2
      IncludeOptional bool    // default: true
  }
  ```

**Сложность:** Низкая. Механическое преобразование TS-интерфейсов в Go-структуры.

**Тесты:** Компилируется, `go build ./...`

---

### Этап 2: PRNG и генератор случайных значений

**Файлы:** `internal/random/random.go`, `internal/random/semantic.go`, `internal/random/random_test.go`

- [ ] **2.1** Реализовать `mulberry32` PRNG:
  ```go
  type RandomGenerator struct {
      state uint32
      seeded bool
  }
  func NewRandomGenerator(seed *int64) *RandomGenerator
  func (r *RandomGenerator) next() float64  // [0, 1)
  ```
- [ ] **2.2** Базовые методы: `String()`, `Number(min, max)`, `Float(min, max)`, `Boolean()`, `Date()`, `Pick(items)`
- [ ] **2.3** Semantic generators:
  - `StringForProperty(name string) (string, bool)` — контекстно-зависимая генерация
  - `Email()`, `URL()`, `Phone()`, `UUID()`, `PersonName()`
- [ ] **2.4** Data pools (FIRST_NAMES, LAST_NAMES, DOMAINS, CITIES, ...)
- [ ] **2.5** Тесты: детерминированность (одинаковый seed → одинаковый результат), UUID format, email format, phone format

**Сложность:** Низкая. Go отлично подходит для числовых операций.

**Тесты:** `go test ./internal/random/...`

---

### Этап 3: TypeScript-парсер

**Файлы:** `internal/parser/lexer.go`, `internal/parser/parser.go`, `internal/parser/ast.go`

Это **самый сложный этап**. Нужно парсить подмножество TypeScript:
- `interface`, `type`, `enum`, `class` declarations
- `import`/`export` declarations
- Property signatures с типами
- Type annotations: primitives, literals, unions, intersections, arrays, tuples, generics, utility types

#### Подход: tree-sitter

- [ ] **3.1** Добавить зависимость `github.com/smacker/go-tree-sitter` + `github.com/smacker/go-tree-sitter/typescript`
- [ ] **3.2** Определить AST-узлы:
  ```go
  type Declaration struct {
      Kind    DeclKind  // Interface, TypeAlias, Enum, Class, Import, Export
      Name    string
      Body    interface{}
      // ...
  }
  ```
- [ ] **3.3** Реализовать `Parse(filePath string) ([]Declaration, error)`:
  - Загрузить файл через `os.ReadFile`
  - Распарсить через tree-sitter
  - Пройти по AST tree-sitter и сконвертировать в наши Declaration
- [ ] **3.4** Обработка `import` declarations — извлечь specifier и imported names
- [ ] **3.5** Обработка `export` declarations — named exports, re-exports
- [ ] **3.6** Парсинг type annotations:
  - Primitives: `string`, `number`, `boolean`, `null`, `undefined`, `void`, `any`, `unknown`, `never`, `bigint`, `symbol`
  - Literals: `"hello"`, `42`, `true`
  - Arrays: `string[]`, `Array<T>`
  - Tuples: `[string, number]`
  - Unions: `string | number`
  - Intersections: `A & B`
  - Type references: `User`, `ApiResponse<User>`
  - Generics: `interface Foo<T, U> { ... }`
  - Utility types: `Record<K,V>`, `Partial<T>`, `Required<T>`, `Pick<T,K>`, `Omit<T,K>`
  - Object literals: `{ views: number; likes: number }`
  - Function types: `(a: string) => void`
  - Mapped types: `{ [K in keyof T]: ... }` (stub)

#### Альтернативный подход (если tree-sitter не подойдёт)

Написать собственный рекурсивный десцент-парсер для подмножества TS:
- Лексер: токенизация ключевых слов, идентификаторов, скобок, стрелок
- Парсер: `parseDeclaration()`, `parseType()`, `parseProperties()`
- Проще в отладке, но больше кода (~1500-2000 строк)

**Сложность:** Высокая. Это ядро проекта.

**Тесты:**
- Парсинг простых интерфейсов
- Парсинг enum'ов (string + numeric)
- Парсинг type alias'ов (union, intersection, tuple)
- Парсинг import/export
- Парсинг generic интерфейсов
- Парсинг nested object types

---

### Этап 4: Резолвер типов

**Файлы:** `internal/resolver/resolver.go`, `internal/resolver/imports.go`, `internal/resolver/npm.go`

- [ ] **4.1** `TypeResolver` struct:
  ```go
  type TypeResolver struct {
      filePath    string
      loadedFiles map[string]bool
      parsedFiles map[string][]parser.Declaration
  }
  func NewTypeResolver(filePath string) (*TypeResolver, error)
  ```
- [ ] **4.2** `ResolveAllTypes() (ResolvedTypes, error)` — пройти по всем parsed declarations и сконвертировать в TypeNode
- [ ] **4.3** `ResolveType(name string) (TypeNode, bool)` — найти конкретный тип
- [ ] **4.4** Резолвинг import-цепочек (`imports.go`):
  - Relative imports: `./models`, `../types`
  - Extension resolution: `.ts`, `.tsx`, `/index.ts`
  - Re-exports: `export { X } from "./module"`
  - Циклические зависимости (visited set)
- [ ] **4.5** Резолвинг npm-пакетов (`npm.go`):
  - Поиск `node_modules/<pkg>/package.json`
  - Извлечение `types` / `typings` поля
  - Парсинг `.d.ts` файлов
  - Рекурсивная загрузка зависимостей пакета
- [ ] **4.6** Generic substitution (`generics.go`):
  - Подстановка type arguments при использовании `TypeReference`
  - Например: `ApiResponse<User>` → заменить `T` на `User` в теле `ApiResponse`
- [ ] **4.7** Interface extends: склеивание properties из родительских интерфейсов
- [ ] **4.8** Поиск `tsconfig.json` для path aliases (опционально)

**Сложность:** Высокая. Требует тщательной обработки edge cases.

**Тесты:**
- Resolve simple interface → InterfaceTypeNode
- Resolve enum → EnumTypeNode
- Resolve union → UnionTypeNode
- Resolve cross-module imports
- Resolve npm package types
- Resolve generics substitution
- Handle circular imports

---

### Этап 5: Генератор моков

**Файлы:** `internal/generator/generator.go`, `internal/generator/primitives.go`, `internal/generator/complex.go`, `internal/generator/utilities.go`

- [ ] **5.1** `MockGenerator` struct:
  ```go
  type MockGenerator struct {
      resolvedTypes types.ResolvedTypes
      options       types.MockOptions
      visitedTypes  map[string]bool
      rng           *random.RandomGenerator
  }
  func NewMockGenerator(resolved types.ResolvedTypes, opts types.MockOptions) *MockGenerator
  func (g *MockGenerator) Generate(typeName string) (interface{}, error)
  func (g *MockGenerator) generateValue(node types.TypeNode, depth int) interface{}
  ```
- [ ] **5.2** Примитивы (`primitives.go`):
  - `string` → random string или semantic (email, name, ...)
  - `number` → random int/float
  - `boolean` → random bool
  - `null`, `undefined`, `void` → nil
  - `bigint` → int64 (JSON-safe)
  - `symbol` → string (JSON-safe)
  - `any`, `unknown` → random object
  - `literal` → literal value
  - `date` → ISO string (JSON-safe)
  - `regexp` → empty string
  - `promise` → inner type
- [ ] **5.3** Сложные типы (`complex.go`):
  - `interface` → `map[string]interface{}` с properties
  - `class` → аналогично interface
  - `enum` → random member value
  - `union` → random pick from resolved types
  - `intersection` → merge all object properties
  - `array` → slice of generated elements
  - `tuple` → fixed-length slice with typed elements
  - `object` → inline object literal
  - `type_reference` → lookup in resolvedTypes + generic substitution
  - `function` → nil (stub)
- [ ] **5.4** Utility types (`utilities.go`):
  - `Record<K,V>` → `map[string]interface{}`
  - `Partial<T>` → все поля optional
  - `Required<T>` → все поля required
  - `Pick<T,K>` → только указанные поля
  - `Omit<T,K>` → без указанных полей
  - `Map<K,V>` → `map[string]interface{}` (JSON-safe)
  - `Set<T>` → `[]interface{}` (JSON-safe, unique)
- [ ] **5.5** Overrides (nested merge):
  ```go
  func mergeOverrides(generated map[string]interface{}, overrides map[string]interface{}) map[string]interface{}
  ```
- [ ] **5.6** Защита от рекурсии: `visitedTypes` + `maxDepth`
- [ ] **5.7** Include optional: пропускать optional properties если `IncludeOptional == false`

**Сложность:** Средняя. Логика прямолинейная, но много switch/case.

**Тесты:**
- Generate User interface
- Generate optional properties (include/exclude)
- Generate nested interfaces
- Generate extending interfaces
- Generate enum (string + numeric)
- Generate union types
- Generate arrays, tuples
- Generate overrides + nested merge
- Generate with custom generators
- Generate with seed (deterministic)
- Generate Record, Partial, Pick, Omit
- Generate intersection types
- Generate class types
- Error for non-existent type

---

### Этап 6: MockContext

**Файлы:** `internal/context/context.go`, `internal/context/context_test.go`

- [ ] **6.1** `MockContext` struct:
  ```go
  type MockContext struct {
      resolver      *resolver.TypeResolver
      resolvedTypes types.ResolvedTypes
      defaultOpts   types.MockOptions
      lazyMode      bool
  }
  func NewMockContext(filePath string, opts types.MockOptions) (*MockContext, error)
  ```
- [ ] **6.2** Методы:
  - `Mock(typeName string, opts ...types.MockOptions) (interface{}, error)`
  - `Many(typeName string, count int, opts ...types.MockOptions) ([]interface{}, error)`
  - `ListTypes() []string`
  - `GetResolvedTypes() types.ResolvedTypes`
- [ ] **6.3** Lazy-режим: резолвить типы по запросу

**Сложность:** Низкая.

**Тесты:** Mock, Many, ListTypes, caching, lazy mode

---

### Этап 7: HTTP/Playwright helpers

**Файлы:** `internal/helpers/response.go`, `internal/helpers/response_test.go`

- [ ] **7.1** `CreateRouteResponse(body interface{}, opts ...RouteResponseOptions) RouteResponse`:
  ```go
  type RouteResponse struct {
      Status      int               `json:"status"`
      ContentType string            `json:"contentType"`
      Headers     map[string]string `json:"headers"`
      Body        string            `json:"body"` // JSON-serialized
  }
  ```
- [ ] **7.2** `CreateApiResponse(data interface{}, opts ...ApiResponseOptions) ApiResponse`:
  ```go
  type ApiResponse struct {
      Data      interface{} `json:"data"`
      Error     *string     `json:"error"`
      Status    int         `json:"status"`
      Timestamp string      `json:"timestamp"`
  }
  ```
- [ ] **7.3** `CreatePaginatedResponse(items []interface{}, opts ...PaginatedOptions) PaginatedResponse`
- [ ] **7.4** JSON marshalling через `encoding/json`

**Сложность:** Низкая.

**Тесты:** Default response, custom status, custom headers, error response, pagination math

---

### Этап 8: Public API (facade)

**Файлы:** `api.go` (в корне пакета)

- [ ] **8.1** Convenience-функции:
  ```go
  func CreateMockFromFile(filePath, typeName string, opts ...types.MockOptions) (interface{}, error)
  func CreateManyMocks(filePath, typeName string, count int, opts ...types.MockOptions) ([]interface{}, error)
  func ListTypes(filePath string) ([]string, error)
  func NewMockContext(filePath string, opts ...types.MockOptions) (*context.MockContext, error)
  ```
- [ ] **8.2** Error handling: все ошибки возвращаются через `error`

**Сложность:** Низкая.

---

### Этап 9: CLI-утилита

**Файлы:** `cmd/go-types-mock/main.go`

- [ ] **9.1** Парсинг аргументов (flag package или cobra):
  ```
  go-types-mock --file types.ts --type User [--count 5] [--seed 42] [--output json]
  go-types-mock --file types.ts --list
  ```
- [ ] **9.2** Вывод результата как pretty-printed JSON в stdout
- [ ] **9.3** Обработка ошибок с exit code

**Сложность:** Низкая.

---

### Этап 10: Тестовые фикстуры и интеграционные тесты

**Файлы:** `testdata/`, `*_test.go` файлы

- [ ] **10.1** Скопировать `tests/fixtures/` → `testdata/` (все .ts файлы)
- [ ] **10.2** Написать Go-тесты, повторяющие все 100 TS-тестов:
  - `internal/parser/parser_test.go` — парсинг
  - `internal/resolver/resolver_test.go` — резолвинг типов
  - `internal/generator/generator_test.go` — генерация моков
  - `internal/random/random_test.go` — PRNG + semantic
  - `internal/helpers/response_test.go` — HTTP helpers
  - `integration_test.go` — end-to-end (file → mock)
  - `internal/context/context_test.go` — кэширование
- [ ] **10.3** Benchmark-тесты:
  ```go
  func BenchmarkCreateMockFromFile(b *testing.B) { ... }
  func BenchmarkMockContextMany(b *testing.B) { ... }
  ```

**Сложность:** Средняя.

---

### Этап 11: Документация и CI

- [ ] **11.1** `README.md` — примеры на Go
- [ ] **11.2** GoDoc-комментарии на всех exported символах
- [ ] **11.3** `Makefile`:
  ```makefile
  test:
      go test ./...
  bench:
      go test -bench=. ./...
  lint:
      golangci-lint run
  build:
      go build -o bin/go-types-mock ./cmd/go-types-mock
  ```
- [ ] **11.4** `.github/workflows/ci.yml` — Go CI (test, lint, build)
- [ ] **11.5** `go vet ./...` + `golangci-lint`

---

### Этап 12: npm-интеграция (опционально)

Если нужна совместимость с существующими TS-проектами:
- [ ] **12.1** WASM-сборка: `GOOS=js GOARCH=wasm go build`
- [ ] **12.2** Обёртка через JS-bridge
- [ ] **12.3** Или: HTTP-сервер (`net/http`) который TS-клиент вызывает для генерации моков

**Сложность:** Высокая. Делать только если реально нужно.

---

## Оценка сложности по этапам

| Этап | Описание | Строк Go (оценка) | Сложность | Зависимости |
|------|----------|-------------------|-----------|-------------|
| 1 | Типы | ~200 | 🟢 Низкая | — |
| 2 | PRNG | ~300 | 🟢 Низкая | Этап 1 |
| 3 | Парсер | ~1500-2000 | 🔴 Высокая | Этап 1 |
| 4 | Резолвер | ~800-1000 | 🔴 Высокая | Этапы 1, 3 |
| 5 | Генератор | ~800-1000 | 🟡 Средняя | Этапы 1, 2 |
| 6 | MockContext | ~150 | 🟢 Низкая | Этапы 4, 5 |
| 7 | HTTP helpers | ~200 | 🟢 Низкая | — |
| 8 | Public API | ~100 | 🟢 Низкая | Этапы 4, 5, 6 |
| 9 | CLI | ~150 | 🟢 Низкая | Этап 8 |
| 10 | Тесты | ~1500-2000 | 🟡 Средняя | Все этапы |
| 11 | Docs + CI | ~300 | 🟢 Низкая | — |
| **Итого** | | **~6000-7000** | | |

## Ключевые зависимости (Go packages)

| Пакет | Назначение | Альтернатива |
|-------|-----------|-------------|
| `github.com/smacker/go-tree-sitter` | Парсинг TS через tree-sitter | Свой парсер |
| `github.com/smacker/go-tree-sitter/typescript` | TypeScript grammar | — |
| `encoding/json` | JSON marshalling | stdlib |
| `os`, `path/filepath` | File I/O | stdlib |
| `math/rand` | Fallback PRNG | stdlib |
| `flag` | CLI args | `github.com/spf13/cobra` |

## Ключевые отличия Go от TS (влияющие на реализацию)

| Аспект | TypeScript | Go |
|--------|-----------|-----|
| Типы моков | `unknown` / `Record<string, unknown>` | `interface{}` / `map[string]interface{}` |
| Enum | `enum` с `string \| number` | `int` + `iota` (TypeKind), `interface{}` (EnumMember.Value) |
| Union types | `A \| B` | Структура с `TypeKind` discriminator |
| Generics | `<T>` | Go generics (1.18+) или interface{} |
| Error handling | `throw new Error()` | `return nil, err` |
| Optional params | `options?: T` | Variadic opts или struct с zero values |
| JSON | `JSON.stringify()` | `json.Marshal()` |
| Date | `new Date()` | `time.Now().Format(time.RFC3339)` |
| Module resolution | Node.js + bundler | `path/filepath` + свой resolver |

## Порядок выполнения (рекомендуемый)

```
Этап 1 (типы)
    ↓
Этап 2 (PRNG)  ──────────────────┐
    ↓                            │
Этап 3 (парсер)                  │
    ↓                            │
Этап 4 (резолвер)                │
    ↓                            │
Этап 5 (генератор) ◄─────────────┘
    ↓
Этап 6 (контекст)
    ↓
Этап 7 (HTTP helpers)
    ↓
Этап 8 (public API)
    ↓
Этап 9 (CLI)
    ↓
Этап 10 (тесты + benchmarks)
    ↓
Этап 11 (docs + CI)
```

Этапы 2 и 7 не зависят от этапа 3-4 и могут выполняться параллельно.

---

## Риски и митигация

| Риск | Влияние | Митигация |
|------|---------|-----------|
| tree-sitter-typescript не покрывает все TS-конструкции | Парсер не сможет разобрать некоторые типы | Написать fallback-парсер для edge cases; покрыть тестами все fixture-файлы |
| Go tree-sitter binding не維護ается | Build failure | Fork или альтернатива (свой парсер) |
| `map[string]interface{}` медленнее TS-объектов | Производительность | Benchmark + оптимизация hot path |
| Резолвинг npm-пакетов сложен в Go | Не все npm-паттерны поддерживаются | Начать с локальных модулей, npm — позже |
| Потеря обратной совместимости с npm-пакетом | Пользователи TS не смогут использовать | WASM-bridge или HTTP-сервер (этап 12) |

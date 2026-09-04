# План миграции typescript-types-mock на Rust + napi-rs

> **Этот план самодостаточен.** Если контекст выполнения потерян — прочитай этот файл, и у тебя будет вся информация для продолжения работы.

## TL;DR

Текущая библиотека (`typescript-types-mock`) переписывается с чистого TypeScript на **Rust core + napi-rs** обёртку. Результат:
- **npm-пакет** с тем же API: `import { createMockFromFile } from "typescript-types-mock"`
- **Ускорение 10-50x** за счёт Rust-ядра (SWC-парсер + zero-copy)
- **React + Playwright** продолжают работать без изменений
- **Кросс-платформа**: prebuilt бинарники для linux/mac/win (x64 + arm64)

---

## Контекст: текущий проект (что уже есть)

### Репо
- GitHub: `github.com/guber00666/typescript-types-mock`
- npm: `typescript-types-mock` (текущая версия 0.4.0)
- Лицензия: MIT
- Автор: `fess00666`

### Структура (TypeScript)
```
typecript-types-mock/
├── src/
│   ├── index.ts                    # Public API: createMockFromFile, createManyMocks, listTypes
│   ├── types/index.ts              # 31 TypeKind enum + 25 TypeNode интерфейсов + MockOptions + ResolvedTypes
│   ├── core/
│   │   ├── type-resolver.ts        # ~813 строк — парсит .ts через ts-morph, резолвит import/export/npm
│   │   ├── type-resolver-interface.ts  # ITypeResolver интерфейс
│   │   ├── mock-generator.ts       # ~645 строк — генерирует mock из TypeNode
│   │   └── mock-context.ts         # ~168 строк — кэширующий MockContext
│   ├── utils/random.ts             # ~264 строки — mulberry32 PRNG + semantic generators
│   └── helpers/playwright.ts       # ~193 строки — createRouteResponse, createApiResponse, createPaginatedResponse
├── tests/                          # 8 тест-файлов, 100 тестов
│   ├── fixtures/sample-types.ts    # Основной фикстур: User, Profile, Address, Company, Admin, Color, etc.
│   ├── fixtures/cross-module/      # Фикстуры для кросс-модульного резолвинга
│   ├── fixtures/npm-package/       # Фикстуры для npm-пакетов
│   └── *.test.ts                   # Тесты
├── examples/demo.ts                # Демонстрация использования
├── package.json                    # npm-конфиг
├── tsconfig.json                   # TS-конфиг
├── rslib.config.ts                 # Сборка ESM + CJS
├── vitest.config.ts                # Тест-конфиг
└── README.md                       # Документация с Playwright-примерами
```

### Public API (который нужно сохранить 1:1)

```typescript
// Основные функции
createMockFromFile(filePath: string, typeName: string, options?: MockOptions): unknown
createManyMocks(filePath: string, typeName: string, count: number, options?: MockOptions): unknown[]
listTypes(filePath: string): string[]

// Кэширующий контекст
createMockContext(filePathOrResolver: string, options?: MockOptions): MockContext

// Playwright helpers
createRouteResponse(body: unknown, options?: RouteResponseOptions): RouteResponse
createApiResponse(data: unknown, options?: ApiResponseOptions): ApiResponse
createPaginatedResponse(items: unknown[], options?: PaginatedOptions): PaginatedResponse

// Экспортируемые классы
TypeResolver          // парсинг .ts файлов
MockGenerator         // генерация mock из ResolvedTypes
MockContext           // кэширующий контекст
RandomGenerator       // PRNG с semantic generators
```

### TypeKind (31 значение — нужно воспроизвести в Rust)
```
String, Number, Boolean, Null, Undefined, Void, BigInt, Symbol, Never,
Any, Unknown, Literal, Array, Tuple, Object, Interface, Class, Enum,
EnumMember, Union, Intersection, TypeReference, Function, Record, Partial,
Required, Pick, Omit, Map, Set, Date, RegExp, Promise, Optional
```

### MockOptions (опции генерации)
```typescript
interface MockOptions {
  filePath?: string;
  seed?: number;              // детерминированная генерация
  overrides?: Record<string, unknown>;  // override значений (nested merge)
  generators?: {              // кастомные генераторы
    string?: () => string;
    number?: () => number;
    boolean?: () => boolean;
    date?: () => Date;
  };
  maxDepth?: number;          // default: 5
  arrayLength?: number;       // default: 2
  includeOptional?: boolean;  // default: true
}
```

### Semantic generators (context-aware string generation)
Свойство → генератор:
- `email`, `*email` → `alice_smith@example.com`
- `url`, `href`, `link`, `*url` → `https://example.com/docs`
- `phone`, `*phone` → `+7 912 345-67-89`
- `id`, `*id`, `uuid` → UUID v4
- `name`, `firstName` → `Alice Smith`
- `title` → `Getting Started`
- `description`, `content`, `body`, `text` → Lorem ipsum
- `city`, `town` → `Moscow`
- `country` → `Russia`
- `street`, `address` → `123 Main St`
- `zipCode`, `postalCode` → `123456`
- `color` → `#FF5733`
- Иначе → random из пула ("Lorem ipsum", "Hello World", "Foo Bar", ...)

### Data pools (для semantic generators)
```
FIRST_NAMES: ["Alice", "Bob", "Charlie", "Diana", "Eve", "Frank", "Grace", "Henry", "Iris", "Jack"]
LAST_NAMES: ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Wilson", "Moore"]
DOMAINS: ["example.com", "test.org", "mock.dev", "demo.io", "sample.net"]
CITIES: ["Moscow", "London", "New York", "Tokyo", "Berlin", "Paris", "Sydney", "Toronto"]
COUNTRIES: ["Russia", "UK", "USA", "Japan", "Germany", "France", "Australia", "Canada"]
STREETS: ["Main", "Oak", "Elm", "Park", "Cedar", "Maple", "Pine", "Birch"]
TITLES: ["Getting Started", "Advanced Guide", "Quick Reference", "Best Practices", ...]
LOREM: ["Lorem ipsum dolor sit amet...", ...]
URL_PATHS: ["about", "docs", "api/v1", "products", "users", ...]
COLORS: ["#FF5733", "#33FF57", "#3357FF", ...]
STRING_POOL: ["Lorem ipsum", "Hello World", "Foo Bar", "Test Value", ...]
```

---

## Целевая архитектура (Rust + napi-rs)

```
typescript-types-mock/              # npm-пакет
├── Cargo.toml                      # Rust-зависимости
├── package.json                    # npm-конфиг (napi-rs настроен)
├── build.rs                        # build script (опционально)
│
├── src/                            # Rust source
│   ├── lib.rs                      # napi exports
│   ├── types/
│   │   ├── mod.rs                  # TypeKind, TypeNode, PropertyNode, etc.
│   │   └── options.rs              # MockOptions (napi struct)
│   ├── parser/
│   │   ├── mod.rs                  # Парсинг .ts файлов
│   │   ├── swc_parser.rs           # SWC-based parser (главный)
│   │   ├── ast_walker.rs           # Обход SWC AST → TypeNode
│   │   └── type_annotations.rs     # Парсинг type annotations
│   ├── resolver/
│   │   ├── mod.rs                  # TypeResolver
│   │   ├── imports.rs              # Import/export chain resolution
│   │   ├── npm.rs                  # npm .d.ts resolution
│   │   └── generics.rs             # Generic type substitution
│   ├── generator/
│   │   ├── mod.rs                  # MockGenerator
│   │   ├── primitives.rs           # string, number, boolean, etc.
│   │   ├── complex.rs              # interface, class, enum, union, etc.
│   │   └── utilities.rs            # Partial, Required, Pick, Omit, Record
│   ├── context/
│   │   └── mod.rs                  # MockContext (caching)
│   ├── random/
│   │   ├── mod.rs                  # RandomGenerator (mulberry32)
│   │   └── semantic.rs             # email, url, phone, uuid, name
│   ├── helpers/
│   │   └── mod.rs                  # createRouteResponse, createApiResponse, etc.
│   └── napi_bridge/
│       └── mod.rs                  # napi bindings (Rust → JS types)
│
├── __test__/                       # JS-тесты (napi-rs convention)
│   ├── index.spec.mjs              # Тесты public API
│   ├── generator.spec.mjs          # Тесты генерации
│   ├── resolver.spec.mjs           # Тесты резолвинга
│   ├── random.spec.mjs             # Тесты PRNG
│   ├── helpers.spec.mjs            # Тесты HTTP helpers
│   └── integration.spec.mjs        # End-to-end тесты
│
├── testdata/                       # TypeScript фикстуры (копия tests/fixtures/)
│   ├── sample-types.ts
│   ├── cross-module/
│   └── npm-package/
│
├── index.js                        # Генерируется napi-rs (loader)
├── index.d.ts                      # Генерируется napi-rs (types)
├── README.md
└── LICENSE
```

---

## Зависимости

### Rust (Cargo.toml)
```toml
[package]
name = "typescript-types-mock"
version = "1.0.0"
edition = "2021"

[lib]
crate-type = ["cdylib"]  # Для napi-rs: динамическая библиотека

[dependencies]
napi = { version = "2", features = ["napi6", "serde-json"] }
napi-derive = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"

# Парсинг TypeScript — SWC (самый быстрый TS-парсер)
swc_common = { version = "0.37", features = ["tty-emitter"] }
swc_ecma_parser = "0.149"
swc_ecma_ast = "0.118"
swc_ecma_visit = "0.104"

# File I/O
walkdir = "2"

# PRNG
rand = "0.8"

# Time
chrono = "0.4"

[build-dependencies]
napi-build = "2"
```

### Node.js (package.json)
```json
{
  "name": "typescript-types-mock",
  "version": "1.0.0",
  "napi": {
    "name": "typescript-types-mock",
    "triples": {
      "defaults": true,
      "additional": [
        "x86_64-unknown-linux-musl",
        "aarch64-unknown-linux-gnu",
        "aarch64-apple-darwin",
        "aarch64-unknown-linux-musl",
        "armv7-unknown-linux-gnueabihf"
      ]
    }
  },
  "devDependencies": {
    "@napi-rs/cli": "^2",
    "ava": "^6"
  },
  "scripts": {
    "artifacts": "napi artifacts",
    "build": "napi build --platform --release",
    "build:debug": "napi build --platform",
    "prepublishOnly": "napi prepublish -t npm",
    "test": "ava",
    "universal": "napi universal",
    "version": "napi version"
  }
}
```

---

## Пошаговый план реализации

### Этап 1: Инициализация napi-rs проекта

**Файлы:** `Cargo.toml`, `package.json`, `src/lib.rs`, `build.rs`

- [ ] 1.1. Создать новый Rust+napi проект:
  ```bash
  npx @napi-rs/cli@latest new typescript-types-mock-rs
  # или вручную:
  cargo init --lib
  ```
- [ ] 1.2. Настроить `Cargo.toml` с зависимостями (см. выше)
- [ ] 1.3. Настроить `package.json` с napi-rs scripts и triples
- [ ] 1.4. `build.rs`:
  ```rust
  extern crate napi_build;
  fn main() { napi_build::setup(); }
  ```
- [ ] 1.5. `src/lib.rs` — минимальный napi export:
  ```rust
  #![deny(clippy::all)]
  use napi_derive::napi;

  #[napi]
  pub fn hello() -> String {
      "Hello from Rust!".to_string()
  }
  ```
- [ ] 1.6. Проверка сборки: `napi build --platform` → проверить что `.node` файл создан
- [ ] 1.7. Проверка из JS: `node -e "console.log(require('./index.js').hello())"`

**Результат:** `napi build --platform` компилирует, JS-код вызывает Rust-функцию.

---

### Этап 2: Внутренние типы (TypeKind, TypeNode, etc.)

**Файлы:** `src/types/mod.rs`, `src/types/options.rs`

- [ ] 2.1. Определить `TypeKind`:
  ```rust
  #[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
  pub enum TypeKind {
      String,
      Number,
      Boolean,
      Null,
      Undefined,
      Void,
      BigInt,
      Symbol,
      Never,
      Any,
      Unknown,
      Literal,
      Array,
      Tuple,
      Object,
      Interface,
      Class,
      Enum,
      EnumMember,
      Union,
      Intersection,
      TypeReference,
      Function,
      Record,
      Partial,
      Required,
      Pick,
      Omit,
      Map,
      Set,
      Date,
      RegExp,
      Promise,
      Optional,
  }
  ```

- [ ] 2.2. Определить `TypeNode` (tagged union в Rust):
  ```rust
  #[derive(Debug, Clone, Serialize, Deserialize)]
  #[serde(tag = "kind")]
  pub enum TypeNode {
      String,
      Number,
      Boolean,
      Null,
      Undefined,
      Void,
      BigInt,
      Symbol,
      Never,
      Any,
      Unknown,
      Literal { value: LiteralValue },
      Array { element_type: Box<TypeNode> },
      Tuple { elements: Vec<TypeNode> },
      Object { properties: Vec<PropertyNode> },
      Interface {
          name: String,
          properties: Vec<PropertyNode>,
          extends: Vec<String>,
          type_parameters: Vec<TypeNode>,
          type_parameter_names: Vec<String>,
      },
      Class {
          name: String,
          properties: Vec<PropertyNode>,
          extends: Option<String>,
          implements: Vec<String>,
      },
      Enum {
          name: String,
          members: Vec<EnumMember>,
      },
      Union { types: Vec<TypeNode> },
      Intersection { types: Vec<TypeNode> },
      TypeReference {
          name: String,
          type_arguments: Vec<TypeNode>,
      },
      Function {
          parameters: Vec<FuncParam>,
          return_type: Box<TypeNode>,
      },
      Record {
          key_type: Box<TypeNode>,
          value_type: Box<TypeNode>,
      },
      Partial { inner_type: Box<TypeNode> },
      Required { inner_type: Box<TypeNode> },
      Pick { inner_type: Box<TypeNode>, keys: Vec<String> },
      Omit { inner_type: Box<TypeNode>, keys: Vec<String> },
      Map {
          key_type: Box<TypeNode>,
          value_type: Box<TypeNode>,
      },
      Set { element_type: Box<TypeNode> },
      Date,
      RegExp,
      Promise { inner_type: Box<TypeNode> },
      Optional { inner_type: Box<TypeNode> },
  }
  ```

- [ ] 2.3. Вспомогательные структуры:
  ```rust
  #[derive(Debug, Clone, Serialize, Deserialize)]
  #[serde(untagged)]
  pub enum LiteralValue {
      String(String),
      Number(f64),
      Boolean(bool),
  }

  #[derive(Debug, Clone, Serialize, Deserialize)]
  pub struct PropertyNode {
      pub name: String,
      #[serde(rename = "type")]
      pub type_node: TypeNode,
      pub optional: bool,
      pub readonly: bool,
  }

  #[derive(Debug, Clone, Serialize, Deserialize)]
  pub struct EnumMember {
      pub name: String,
      pub value: LiteralValue,
  }

  #[derive(Debug, Clone, Serialize, Deserialize)]
  pub struct FuncParam {
      pub name: String,
      #[serde(rename = "type")]
      pub type_node: TypeNode,
      pub optional: bool,
  }

  pub type ResolvedTypes = std::collections::HashMap<String, TypeNode>;
  ```

- [ ] 2.4. `MockOptions`:
  ```rust
  #[napi(object)]
  #[derive(Debug, Clone)]
  pub struct MockOptions {
      pub seed: Option<i64>,
      pub overrides: Option<serde_json::Value>,
      pub max_depth: Option<u32>,
      pub array_length: Option<u32>,
      pub include_optional: Option<bool>,
  }
  ```
  **Примечание:** Custom generators (`() => string`) нельзя передавать через napi-rs напрямую.
  Для JS-callbacks использовать `napi::JsFunction` или оставить generators только в JS-обёртке.

**Результат:** `cargo build` компилируется, типы корректно сериализуются в JSON.

---

### Этап 3: PRNG и semantic generators

**Файлы:** `src/random/mod.rs`, `src/random/semantic.rs`

- [ ] 3.1. Mulberry32 PRNG:
  ```rust
  pub struct RandomGenerator {
      state: u32,
      seeded: bool,
  }

  impl RandomGenerator {
      pub fn new(seed: Option<i64>) -> Self { /* ... */ }
      pub fn next(&mut self) -> f64 { /* [0, 1) */ }
      pub fn string(&mut self) -> String { /* ... */ }
      pub fn number(&mut self, min: Option<i64>, max: Option<i64>) -> i64 { /* ... */ }
      pub fn float(&mut self, min: Option<f64>, max: Option<f64>) -> f64 { /* ... */ }
      pub fn boolean(&mut self) -> bool { /* ... */ }
      pub fn date(&mut self) -> String { /* ISO 8601 */ }
      pub fn pick<T>(&mut self, items: &[T]) -> &T { /* ... */ }
  }
  ```
- [ ] 3.2. Data pools (FIRST_NAMES, LAST_NAMES, DOMAINS, etc.) — скопировать из TS
- [ ] 3.3. Semantic generators:
  ```rust
  impl RandomGenerator {
      pub fn string_for_property(&mut self, name: &str) -> Option<String> { /* ... */ }
      pub fn email(&mut self) -> String { /* ... */ }
      pub fn url(&mut self) -> String { /* ... */ }
      pub fn phone(&mut self) -> String { /* ... */ }
      pub fn uuid(&mut self) -> String { /* ... */ }
      pub fn person_name(&mut self) -> String { /* ... */ }
      pub fn address(&mut self) -> String { /* ... */ }
      pub fn city(&mut self) -> String { /* ... */ }
      pub fn country(&mut self) -> String { /* ... */ }
      pub fn color(&mut self) -> String { /* ... */ }
  }
  ```
- [ ] 3.4. Unit-тесты в Rust (`#[cfg(test)]`):
  - Детерминированность: `seed(42)` → одинаковая последовательность
  - UUID format
  - Email format
  - Phone format

**Результат:** `cargo test --lib random` — все тесты проходят.

---

### Этап 4: TypeScript-парсер (SWC)

**Файлы:** `src/parser/mod.rs`, `src/parser/swc_parser.rs`, `src/parser/ast_walker.rs`

- [ ] 4.1. Парсинг .ts файла через SWC:
  ```rust
  use swc_ecma_parser::{Parser, StringInput, Syntax, TsSyntax};
  use swc_ecma_ast::Module;

  pub fn parse_file(file_path: &str) -> Result<Module, String> {
      let source = std::fs::read_to_string(file_path)?;
      let syntax = Syntax::Typescript(TsSyntax {
          tsx: file_path.ends_with(".tsx"),
          decorators: true,
          ..Default::default()
      });
      // ... parse using SWC Parser
  }
  ```
- [ ] 4.2. AST walker: обход SWC AST → наши TypeNode:
  ```rust
  use swc_ecma_visit::{Visit, VisitWith};

  pub struct TypeExtractor {
      pub declarations: Vec<Declaration>,
  }

  impl Visit for TypeExtractor {
      fn visit_ts_interface_decl(&mut self, decl: &TsInterfaceDecl) { /* ... */ }
      fn visit_ts_type_alias_decl(&mut self, decl: &TsTypeAliasDecl) { /* ... */ }
      fn visit_ts_enum_decl(&mut self, decl: &TsEnumDecl) { /* ... */ }
      fn visit_class_decl(&mut self, decl: &ClassDecl) { /* ... */ }
      fn visit_import_decl(&mut self, decl: &ImportDecl) { /* ... */ }
      fn visit_export_decl(&mut self, decl: &ExportDecl) { /* ... */ }
      fn visit_named_export(&mut self, decl: &NamedExport) { /* ... */ }
  }
  ```
- [ ] 4.3. Конвертация type annotations:
  ```rust
  fn convert_type_ann(type_ann: &TsType) -> TypeNode {
      match type_ann {
          TsType::TsKeywordType(kw) => match kw.kind {
              TsKeywordTypeKind::TsStringKeyword => TypeNode::String,
              TsKeywordTypeKind::TsNumberKeyword => TypeNode::Number,
              // ... все keyword types
          },
          TsType::TsTypeRef(r) => convert_type_reference(r),
          TsType::TsArrayType(arr) => TypeNode::Array {
              element_type: Box::new(convert_type_ann(&arr.elem_type)),
          },
          TsType::TsUnionOrIntersectionType(ui) => /* ... */,
          TsType::TsTupleType(tuple) => /* ... */,
          TsType::TsLiteralType(lit) => /* ... */,
          TsType::TsTypeLit(lit) => convert_type_literal(lit),
          // ... остальные варианты
      }
  }
  ```
- [ ] 4.4. Utility types detection:
  ```rust
  fn convert_type_reference(r: &TsTypeRef) -> TypeNode {
      let name = type_name_to_string(&r.type_name);
      let args = r.type_params.as_ref()
          .map(|p| p.params.iter().map(|a| convert_type_ann(a)).collect())
          .unwrap_or_default();

      match name.as_str() {
          "Array" | "ReadonlyArray" => TypeNode::Array { element_type: Box::new(args.into_iter().next().unwrap_or(TypeNode::Any)) },
          "Record" => TypeNode::Record { /* ... */ },
          "Partial" => TypeNode::Partial { /* ... */ },
          "Required" => TypeNode::Required { /* ... */ },
          "Pick" => TypeNode::Pick { /* ... */ },
          "Omit" => TypeNode::Omit { /* ... */ },
          "Map" => TypeNode::Map { /* ... */ },
          "Set" => TypeNode::Set { /* ... */ },
          "Date" => TypeNode::Date,
          "RegExp" => TypeNode::RegExp,
          "Promise" => TypeNode::Promise { /* ... */ },
          _ => TypeNode::TypeReference { name, type_arguments: args },
      }
  }
  ```
- [ ] 4.5. Тесты: парсинг `testdata/sample-types.ts` → проверка что все типы распознаны

**Результат:** `parse_file("testdata/sample-types.ts")` возвращает все 20+ declarations.

---

### Этап 5: Резолвер типов

**Файлы:** `src/resolver/mod.rs`, `src/resolver/imports.rs`, `src/resolver/npm.rs`, `src/resolver/generics.rs`

- [ ] 5.1. `TypeResolver`:
  ```rust
  pub struct TypeResolver {
      pub file_path: String,
      loaded_files: HashSet<String>,
      parsed_modules: HashMap<String, Vec<Declaration>>,
  }

  impl TypeResolver {
      pub fn new(file_path: &str) -> Result<Self, String> { /* ... */ }
      pub fn resolve_all_types(&mut self) -> Result<ResolvedTypes, String> { /* ... */ }
      pub fn resolve_type(&mut self, name: &str) -> Option<TypeNode> { /* ... */ }
  }
  ```
- [ ] 5.2. Import resolution (`imports.rs`):
  - Relative: `./models` → найти `./models.ts`, `./models/index.ts`
  - Re-exports: `export { X } from "./module"` → follow and collect
  - Circular deps: visited set
- [ ] 5.3. npm package resolution (`npm.rs`):
  - Найти `node_modules/<pkg>/package.json`
  - Извлечь `types`/`typings` field
  - Парсить `.d.ts` файлы
  - Рекурсивно загрузить зависимости
- [ ] 5.4. Interface extends: merge parent properties
- [ ] 5.5. Generic substitution (`generics.rs`):
  - `ApiResponse<User>` → substitute `T` → `User` in body
- [ ] 5.6. Тесты:
  - Resolve simple interface
  - Resolve enum
  - Resolve cross-module imports
  - Resolve npm package types
  - Handle circular imports

**Результат:** `TypeResolver::new("testdata/sample-types.ts").resolve_all_types()` возвращает полный `ResolvedTypes`.

---

### Этап 6: Mock-генератор

**Файлы:** `src/generator/mod.rs`, `src/generator/primitives.rs`, `src/generator/complex.rs`, `src/generator/utilities.rs`

- [ ] 6.1. `MockGenerator`:
  ```rust
  pub struct MockGenerator {
      resolved_types: ResolvedTypes,
      options: ResolvedOptions,
      visited_types: HashSet<String>,
      rng: RandomGenerator,
  }

  impl MockGenerator {
      pub fn new(resolved: ResolvedTypes, options: MockOptions) -> Self { /* ... */ }
      pub fn generate(&mut self, type_name: &str) -> Result<serde_json::Value, String> { /* ... */ }
      pub fn generate_value(&mut self, node: &TypeNode, depth: u32) -> serde_json::Value { /* ... */ }
  }
  ```
- [ ] 6.2. Primitives (`primitives.rs`):
  - `String` → random string or semantic
  - `Number` → random i64/f64
  - `Boolean` → random bool
  - `Null/Undefined/Void` → `serde_json::Value::Null`
  - `Literal` → literal value
  - `BigInt` → number (JSON-safe)
  - `Symbol` → string (JSON-safe)
  - `Date` → ISO 8601 string
  - `RegExp` → empty string
  - `Promise` → inner type
- [ ] 6.3. Complex (`complex.rs`):
  - `Interface` → `serde_json::Value::Object` with properties
  - `Class` → same as Interface
  - `Enum` → random member value
  - `Union` → random pick
  - `Intersection` → merge all properties
  - `Array` → `serde_json::Value::Array`
  - `Tuple` → fixed-length array
  - `TypeReference` → lookup + generic substitution
  - `Function` → null
- [ ] 6.4. Utilities (`utilities.rs`):
  - `Record<K,V>` → `map[string]interface{}`
  - `Partial<T>` → all optional
  - `Required<T>` → all required
  - `Pick<T,K>` → only specified keys
  - `Omit<T,K>` → exclude keys
  - `Map<K,V>` → object (JSON-safe)
  - `Set<T>` → array (JSON-safe, unique)
- [ ] 6.5. Overrides (nested merge):
  ```rust
  fn merge_overrides(generated: &mut serde_json::Value, overrides: &serde_json::Value) { /* ... */ }
  ```
- [ ] 6.6. Recursion protection: `visited_types` + `max_depth`
- [ ] 6.7. Тесты (Rust `#[cfg(test)]`):
  - Generate User → has name, age, email
  - Generate with seed → deterministic
  - Generate with overrides → values overridden
  - Generate nested → Company.address.city exists

**Результат:** `MockGenerator::generate("User")` возвращает корректный `serde_json::Value`.

---

### Этап 7: MockContext (кэширование)

**Файлы:** `src/context/mod.rs`

- [ ] 7.1. `MockContext`:
  ```rust
  pub struct MockContext {
      resolver: TypeResolver,
      resolved_types: ResolvedTypes,
      default_options: MockOptions,
      lazy: bool,
  }

  impl MockContext {
      pub fn new(file_path: &str, options: MockOptions) -> Result<Self, String> { /* ... */ }
      pub fn mock(&mut self, type_name: &str, options: Option<MockOptions>) -> Result<serde_json::Value, String> { /* ... */ }
      pub fn many(&mut self, type_name: &str, count: u32, options: Option<MockOptions>) -> Result<Vec<serde_json::Value>, String> { /* ... */ }
      pub fn list_types(&mut self) -> Vec<String> { /* ... */ }
  }
  ```

**Результат:** Компилируется, тесты проходят.

---

### Этап 8: HTTP/Playwright helpers

**Файлы:** `src/helpers/mod.rs`

- [ ] 8.1. `create_route_response`:
  ```rust
  #[napi(object)]
  pub struct RouteResponse {
      pub status: i32,
      pub content_type: String,
      pub headers: HashMap<String, String>,
      pub body: String,
  }

  #[napi]
  pub fn create_route_response(
      body: serde_json::Value,
      options: Option<RouteResponseOptions>,
  ) -> RouteResponse { /* ... */ }
  ```
- [ ] 8.2. `create_api_response` + `create_paginated_response`

**Результат:** JS-код получает объекты с правильными полями.

---

### Этап 9: napi bridge (Rust → JS)

**Файлы:** `src/lib.rs`, `src/napi_bridge/mod.rs`

- [ ] 9.1. Экспортировать все public функции через `#[napi]`:
  ```rust
  #[napi]
  pub fn create_mock_from_file(
      file_path: String,
      type_name: String,
      options: Option<MockOptions>,
  ) -> napi::Result<serde_json::Value> { /* ... */ }

  #[napi]
  pub fn create_many_mocks(
      file_path: String,
      type_name: String,
      count: u32,
      options: Option<MockOptions>,
  ) -> napi::Result<Vec<serde_json::Value>> { /* ... */ }

  #[napi]
  pub fn list_types(file_path: String) -> napi::Result<Vec<String>> { /* ... */ }
  ```
- [ ] 9.2. Экспортировать классы через `#[napi]`:
  ```rust
  #[napi]
  impl NapiMockContext {
      #[napi(constructor)]
      pub fn new(file_path: String, options: Option<MockOptions>) -> napi::Result<Self> { /* ... */ }

      #[napi]
      pub fn mock(&mut self, type_name: String, options: Option<MockOptions>) -> napi::Result<serde_json::Value> { /* ... */ }

      #[napi]
      pub fn many(&mut self, type_name: String, count: u32, options: Option<MockOptions>) -> napi::Result<Vec<serde_json::Value>> { /* ... */ }

      #[napi]
      pub fn list_types(&mut self) -> Vec<String> { /* ... */ }
  }
  ```
- [ ] 9.3. JS-обёртка (`index.js` / `index.d.ts`) для совместимости:
  ```typescript
  // index.d.ts (дополняет сгенерированный napi-rs)
  export function createMockFromFile(filePath: string, typeName: string, options?: MockOptions): unknown;
  export function createManyMocks(filePath: string, typeName: string, count: number, options?: MockOptions): unknown[];
  export function listTypes(filePath: string): string[];
  export class MockContext {
      constructor(filePath: string, options?: MockOptions);
      mock(typeName: string, options?: MockOptions): unknown;
      many(typeName: string, count: number, options?: MockOptions): unknown[];
      listTypes(): string[];
  }
  // ...
  ```

**Результат:** `const { createMockFromFile } = require("typescript-types-mock")` работает из Node.js.

---

### Этап 10: JS-обёртка для полной совместимости API

**Файлы:** `index.js` (тонкая JS-обёртка поверх .node binary)

Проблема: napi-rs не поддерживает передачу JS-callback (custom generators `() => string`)
в Rust напрямую через object structs. Решение: JS-обёртка.

```javascript
// index.js — тонкая обёртка
const native = require('./typescript-types-mock.linux-x64-gnu.node');

function createMockFromFile(filePath, typeName, options = {}) {
    const { generators, ...rest } = options;
    let result = native.createMockFromFile(filePath, typeName, rest);

    // Post-process: apply custom generators on JS side
    if (generators) {
        result = applyGenerators(result, generators);
    }
    return result;
}

// Аналогично для createManyMocks, MockContext, etc.
module.exports = { createMockFromFile, createManyMocks, listTypes, ... };
```

**Результат:** Полный API совместим с TS-версией, включая custom generators.

---

### Этап 11: Тестовые фикстуры и тесты

**Файлы:** `testdata/`, `__test__/*.spec.mjs`

- [ ] 11.1. Скопировать все фикстуры из `tests/fixtures/` → `testdata/`
- [ ] 11.2. Портировать все 100 тестов:
  ```javascript
  // __test__/generator.spec.mjs
  import test from 'ava';
  import { createMockFromFile, createMockContext } from '../index.js';
  import { fileURLToPath } from 'url';
  import { dirname, resolve } from 'path';

  const FIXTURES = resolve(dirname(fileURLToPath(import.meta.url)), '../testdata/sample-types.ts');

  test('should create a mock for User', (t) => {
      const user = createMockFromFile(FIXTURES, 'User');
      t.is(typeof user.name, 'string');
      t.is(typeof user.age, 'number');
      t.is(typeof user.isActive, 'boolean');
  });

  test('should support seed for deterministic output', (t) => {
      const a = createMockFromFile(FIXTURES, 'User', { seed: 42 });
      const b = createMockFromFile(FIXTURES, 'User', { seed: 42 });
      t.deepEqual(a, b);
  });
  // ... ещё 98 тестов
  ```
- [ ] 11.3. Benchmarks:
  ```javascript
  // __test__/bench.spec.mjs
  test('benchmark: createMockFromFile', (t) => {
      const start = performance.now();
      for (let i = 0; i < 10000; i++) {
          createMockFromFile(FIXTURES, 'User');
      }
      const elapsed = performance.now() - start;
      console.log(`10000 mocks in ${elapsed.toFixed(0)}ms (${(10000/elapsed*1000).toFixed(0)} ops/s)`);
      t.pass();
  });
  ```

**Результат:** `npm test` — все 100 тестов проходят.

---

### Этап 12: Кросс-платформенная сборка и CI

**Файлы:** `.github/workflows/ci.yml`

- [ ] 12.1. GitHub Actions для CI:
  ```yaml
  name: CI
  on: [push, pull_request]
  jobs:
    build:
      strategy:
        matrix:
          os: [ubuntu-latest, macos-latest, windows-latest]
          node: [18, 20, 22]
      runs-on: ${{ matrix.os }}
      steps:
        - uses: actions/checkout@v4
        - uses: actions/setup-node@v4
          with:
            node-version: ${{ matrix.node }}
        - uses: dtolnay/rust-toolchain@stable
        - run: npm install
        - run: napi build --platform --release
        - run: npm test
  ```
- [ ] 12.2. GitHub Actions для публикации prebuilt бинарников:
  ```yaml
  name: Publish
  on:
    release:
      types: [published]
  jobs:
    build-binaries:
      strategy:
        matrix:
          target:
            - x86_64-apple-darwin
            - aarch64-apple-darwin
            - x86_64-unknown-linux-gnu
            - x86_64-unknown-linux-musl
            - aarch64-unknown-linux-gnu
            - x86_64-pc-windows-msvc
      runs-on: ${{ matrix.os }}
      steps:
        - uses: actions/checkout@v4
        - uses: actions/setup-node@v4
        - uses: dtolnay/rust-toolchain@stable
        - run: npm install
        - run: napi build --platform --release --target ${{ matrix.target }}
        - run: napi artifacts
        - uses: actions/upload-artifact@v4
    publish-npm:
      needs: build-binaries
      runs-on: ubuntu-latest
      steps:
        - run: napi prepublish -t npm
        - run: npm publish
  ```
- [ ] 12.3. Тестировать на каждой платформе:
  ```bash
  # macOS
  napi build --platform --release
  npm test

  # Linux
  napi build --platform --release
  npm test

  # Windows
  napi build --platform --release
  npm test
  ```

**Результат:** CI зелёный, npm publish работает, prebuilt бинарники доступны.

---

### Этап 13: Документация и README

- [ ] 13.1. Обновить `README.md`:
  - Убрать упоминание `ts-morph` как зависимости
  - Добавить секцию "Performance" с benchmarks
  - Примеры остаются идентичными (API не изменился)
- [ ] 13.2. `CHANGELOG.md` с описанием миграции
- [ ] 13.3. Обновить `package.json` keywords

---

## Оценка сложности

| Этап | Описание | Строк Rust | Сложность |
|------|----------|------------|-----------|
| 1 | Инициализация napi-rs | ~30 | 🟢 |
| 2 | Типы | ~300 | 🟢 |
| 3 | PRNG + semantic | ~400 | 🟢 |
| 4 | Парсер (SWC) | ~800-1200 | 🔴 Высокая |
| 5 | Резолвер | ~600-800 | 🔴 Высокая |
| 6 | Генератор | ~700-900 | 🟡 Средняя |
| 7 | MockContext | ~150 | 🟢 |
| 8 | HTTP helpers | ~200 | 🟢 |
| 9 | napi bridge | ~200 | 🟡 Средняя |
| 10 | JS-обёртка | ~100 | 🟢 |
| 11 | Тесты | ~1500 | 🟡 Средняя |
| 12 | CI/CD | ~150 | 🟡 Средняя |
| 13 | Документация | ~200 | 🟢 |
| **Итого** | | **~5300-6300** | |

## Порядок выполнения

```
Этап 1 (napi-rs init)
    ↓
Этап 2 (типы)
    ↓
Этап 3 (PRNG)          ←──────── можно параллельно с 4
    ↓                      ↓
Этап 4 (SWC парсер)    Этап 8 (helpers)
    ↓                      ↓
Этап 5 (резолвер)      Этап 7 (context) ← зависит от 4, 5
    ↓
Этап 6 (генератор) ← зависит от 2, 3
    ↓
Этап 9 (napi bridge)
    ↓
Этап 10 (JS-обёртка)
    ↓
Этап 11 (тесты)
    ↓
Этап 12 (CI/CD)
    ↓
Этап 13 (docs)
```

## Риски и митигация

| Риск | Влияние | Митигация |
|------|---------|-----------|
| SWC API нестабилен | Breaking changes при обновлении | Pin конкретная версия, покрыть тестами |
| napi-rs не поддерживает JS callbacks в options | Custom generators не работают | JS-обёртка (этап 10) обрабатывает generators |
| Cross-compilation fails на Windows | Нет .node файла для Windows | CI matrix + manual testing |
| npm package size слишком большой | Пользователи жалуются | Stripped binaries, only needed triples |
| `serde_json::Value` медленнее TS-объектов | Не ожидаемый speedup | Benchmark + оптимизация hot path |

## Как проверить что всё работает

```bash
# 1. Сборка
napi build --platform --release

# 2. Smoke test
node -e "const m = require('./index.js'); console.log(m.createMockFromFile('testdata/sample-types.ts', 'User'))"

# 3. Полный тест-сьют
npm test

# 4. Benchmark
node -e "
const { createMockFromFile } = require('./index.js');
const start = Date.now();
for (let i = 0; i < 10000; i++) createMockFromFile('testdata/sample-types.ts', 'User');
console.log(Date.now() - start, 'ms for 10k mocks');
"
```

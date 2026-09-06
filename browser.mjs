// typescript-types-mock/browser
// Browser-compatible API backed by WebAssembly (SWC parser compiled to WASM)
//
// Usage:
//   import { init, mockFromSource, listTypes, MockContext } from 'typescript-types-mock/browser';
//   await init(); // Load WASM module once
//   const mock = mockFromSource('interface User { name: string; }', 'User');

import wasmInit, {
  mock_from_source_wasm,
  list_types_wasm,
  version_wasm,
} from './dist/wasm/typescript_types_mock.js';

let _initialized = false;

/**
 * Initialize the WASM module. Call once before using any other functions.
 * @param {string|URL|Request|Response} [wasmUrl] - Optional URL to the .wasm file
 */
export async function init(wasmUrl) {
  if (_initialized) return;
  await wasmInit(wasmUrl);
  _initialized = true;
}

function ensureInit() {
  if (!_initialized) {
    throw new Error('typescript-types-mock/browser: Call await init() first.');
  }
}

/**
 * Parse TypeScript source and generate a mock for the given type.
 */
export function mockFromSource(source, typeName, options) {
  ensureInit();
  const opts = options ? JSON.stringify(options) : '';
  const jsonStr = mock_from_source_wasm(source, typeName, opts);
  return JSON.parse(jsonStr);
}

/**
 * List all type names in the source.
 */
export function listTypes(source) {
  ensureInit();
  return JSON.parse(list_types_wasm(source));
}

/**
 * Get module version.
 */
export function version() {
  ensureInit();
  return version_wasm();
}

/**
 * Browser MockContext — caches source for repeated mock generation.
 */
export class MockContext {
  constructor(source, defaultOptions = {}) {
    this._source = source;
    this._defaultOptions = defaultOptions;
  }

  mock(typeName, options) {
    return mockFromSource(this._source, typeName, { ...this._defaultOptions, ...options });
  }

  createMock(typeName, options) { return this.mock(typeName, options); }

  many(typeName, count, options) {
    const merged = { ...this._defaultOptions, ...options };
    return Array.from({ length: count }, () => mockFromSource(this._source, typeName, merged));
  }

  createMany(typeName, count, options) { return this.many(typeName, count, options); }

  listTypes() { return listTypes(this._source); }

  mockProperty(typeName, propertyPath, options) {
    const m = this.mock(typeName, options);
    let current = m;
    for (const part of propertyPath.split('.')) {
      if (current == null || typeof current !== 'object') return undefined;
      current = current[part];
    }
    return current;
  }
}

export function createMockContext(source, defaultOptions) {
  return new MockContext(source, defaultOptions);
}

// ─── Playwright helpers (pure JS, no WASM needed) ──────

export function createRouteResponse(body, options = {}) {
  return {
    status: options.status ?? 200,
    contentType: options.contentType ?? 'application/json',
    headers: { 'content-type': options.contentType ?? 'application/json', ...options.headers },
    body: JSON.stringify(body),
  };
}

export function createApiResponse(data, options = {}) {
  return {
    data,
    error: options.error ?? null,
    status: options.status ?? 200,
    timestamp: options.timestamp !== false ? new Date().toISOString() : undefined,
  };
}

export function createPaginatedResponse(items, options = {}) {
  const page = options.page ?? 1;
  const pageSize = options.pageSize ?? items.length;
  const total = options.total ?? items.length;
  return {
    data: items,
    meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    status: options.status ?? 200,
    timestamp: new Date().toISOString(),
  };
}

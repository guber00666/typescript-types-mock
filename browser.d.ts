// Type definitions for typescript-types-mock/browser

export interface MockOptions {
  seed?: number;
  overrides?: Record<string, unknown>;
  maxDepth?: number;
  arrayLength?: number;
  includeOptional?: boolean;
}

export interface RouteResponseOptions {
  status?: number;
  headers?: Record<string, string>;
  contentType?: string;
}

export interface ApiResponseOptions {
  status?: number;
  error?: string | null;
  timestamp?: boolean;
}

export interface PaginatedResponseOptions {
  page?: number;
  pageSize?: number;
  total?: number;
  status?: number;
}

export interface RouteResponse {
  status: number;
  contentType: string;
  headers: Record<string, string>;
  body: string;
}

export interface ApiResponse<T = unknown> {
  data: T;
  error: string | null;
  status: number;
  timestamp: string;
}

export interface PaginatedResponse<T = unknown> {
  data: T[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
  status: number;
  timestamp: string;
}

/** Initialize the WASM module. Must be called before using other functions. */
export declare function init(wasmUrl?: string | URL | Request | Response): Promise<void>;

/** Parse TypeScript source and generate a mock. */
export declare function mockFromSource(source: string, typeName: string, options?: MockOptions): unknown;

/** List all type names in the source. */
export declare function listTypes(source: string): string[];

/** Get module version. */
export declare function version(): string;

/** Browser-compatible MockContext. */
export declare class MockContext {
  constructor(source: string, defaultOptions?: MockOptions);
  mock(typeName: string, options?: MockOptions): unknown;
  createMock(typeName: string, options?: MockOptions): unknown;
  many(typeName: string, count: number, options?: MockOptions): unknown[];
  createMany(typeName: string, count: number, options?: MockOptions): unknown[];
  listTypes(): string[];
  mockProperty(typeName: string, propertyPath: string, options?: MockOptions): unknown;
}

export declare function createMockContext(source: string, defaultOptions?: MockOptions): MockContext;
export declare function createRouteResponse(body: unknown, options?: RouteResponseOptions): RouteResponse;
export declare function createApiResponse<T = unknown>(data: T, options?: ApiResponseOptions): ApiResponse<T>;
export declare function createPaginatedResponse<T = unknown>(items: T[], options?: PaginatedResponseOptions): PaginatedResponse<T>;

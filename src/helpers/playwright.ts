/**
 * Playwright-specific helpers for typescript-types-mock.
 *
 * These utilities simplify mock generation for Playwright e2e tests
 * by providing ready-to-use response objects for route interception.
 *
 * @example
 * ```typescript
 * import { createMockFromFile } from 'typescript-types-mock';
 * import { createRouteResponse, createApiResponse } from 'typescript-types-mock/helpers';
 *
 * // In your Playwright test:
 * await page.route('**\/api/users', (route) => {
 *   const user = createMockFromFile('./types.ts', 'User');
 *   route.fulfill(createRouteResponse(user));
 * });
 *
 * // Or with API wrapper:
 * await page.route('**\/api/users', (route) => {
 *   const user = createMockFromFile('./types.ts', 'User');
 *   route.fulfill(createRouteResponse(createApiResponse(user)));
 * });
 * ```
 */

/**
 * Options for Playwright route response.
 */
export interface RouteResponseOptions {
  /** HTTP status code (default: 200) */
  status?: number;
  /** Custom response headers */
  headers?: Record<string, string>;
  /** Content-Type header (default: "application/json") */
  contentType?: string;
}

/**
 * Create a Playwright-compatible route.fulfill() response object.
 *
 * Generates a JSON-serializable response suitable for:
 * - `route.fulfill(response)` — Playwright route interception
 * - `page.evaluate()` — passing data into the browser context
 *
 * @param body - The response body (will be JSON.stringify'd)
 * @param options - Response configuration
 * @returns An object compatible with Playwright's `route.fulfill()` parameter
 *
 * @example
 * ```typescript
 * const user = createMockFromFile('./types.ts', 'User');
 *
 * await page.route('**\/api/user', (route) => {
 *   route.fulfill(createRouteResponse(user));
 * });
 * // → { status: 200, contentType: 'application/json', body: '{"name":"...","age":42}' }
 *
 * // Custom status:
 * route.fulfill(createRouteResponse(user, { status: 201 }));
 *
 * // Error response:
 * route.fulfill(createRouteResponse({ error: 'Not found' }, { status: 404 }));
 * ```
 */
export function createRouteResponse(
  body: unknown,
  options: RouteResponseOptions = {}
): {
  status: number;
  contentType: string;
  headers: Record<string, string>;
  body: string;
} {
  const status = options.status ?? 200;
  const contentType = options.contentType ?? "application/json";
  const headers = {
    "content-type": contentType,
    ...options.headers,
  };

  return {
    status,
    contentType,
    headers,
    body: JSON.stringify(body),
  };
}

/**
 * Standard API response wrapper options.
 */
export interface ApiResponseOptions {
  /** HTTP status code (default: 200) */
  status?: number;
  /** Error message (if any) */
  error?: string | null;
  /** Include timestamp (default: true) */
  timestamp?: boolean;
}

/**
 * Wrap a mock value in a standard API response envelope.
 *
 * Generates a response object matching common REST API patterns:
 * ```json
 * {
 *   "data": <your mock>,
 *   "error": null,
 *   "status": 200,
 *   "timestamp": "2024-01-15T10:30:00.000Z"
 * }
 * ```
 *
 * @param data - The mock data to wrap
 * @param options - Response configuration
 * @returns An API response envelope object
 *
 * @example
 * ```typescript
 * const user = createMockFromFile('./types.ts', 'User');
 * const response = createApiResponse(user);
 * // → { data: { name: "...", ... }, error: null, status: 200, timestamp: "..." }
 *
 * // Error response:
 * const errorResponse = createApiResponse(null, { status: 404, error: 'Not found' });
 * ```
 */
export function createApiResponse<T = unknown>(
  data: T,
  options: ApiResponseOptions = {}
): {
  data: T;
  error: string | null;
  status: number;
  timestamp: string;
} {
  return {
    data,
    error: options.error ?? null,
    status: options.status ?? 200,
    timestamp: options.timestamp !== false ? new Date().toISOString() : "",
  };
}

/**
 * Create a paginated API response.
 *
 * @param items - Array of mock items
 * @param options - Pagination and response options
 * @returns A paginated API response object
 *
 * @example
 * ```typescript
 * const users = createManyMocks('./types.ts', 'User', 10);
 * const response = createPaginatedResponse(users, { page: 1, pageSize: 10, total: 50 });
 * // → { data: [...], meta: { page: 1, pageSize: 10, total: 50, totalPages: 5 }, ... }
 * ```
 */
export function createPaginatedResponse<T = unknown>(
  items: T[],
  options: {
    page?: number;
    pageSize?: number;
    total?: number;
    status?: number;
  } = {}
): {
  data: T[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  status: number;
  timestamp: string;
} {
  const page = options.page ?? 1;
  const pageSize = options.pageSize ?? items.length;
  const total = options.total ?? items.length;

  return {
    data: items,
    meta: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
    status: options.status ?? 200,
    timestamp: new Date().toISOString(),
  };
}

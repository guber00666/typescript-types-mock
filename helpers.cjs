// typescript-types-mock/helpers
// Playwright-specific helpers for route interception and API response mocking.
//
// Usage:
//   const { createRouteResponse, createApiResponse, createPaginatedResponse } = require('typescript-types-mock/helpers');
//
// Or with ESM:
//   import { createRouteResponse } from 'typescript-types-mock/helpers';

/**
 * Create a Playwright-compatible route.fulfill() response object.
 *
 * @param {unknown} body - The response body (will be JSON.stringify'd)
 * @param {Object} [options]
 * @param {number} [options.status=200] - HTTP status code
 * @param {string} [options.contentType="application/json"] - Content-Type header
 * @param {Record<string, string>} [options.headers] - Additional headers
 * @returns {{ status: number, contentType: string, headers: Record<string, string>, body: string }}
 *
 * @example
 * const user = createMockFromFile('./types.ts', 'User');
 * await page.route('**\/api/user', (route) => {
 *   route.fulfill(createRouteResponse(user));
 * });
 */
function createRouteResponse(body, options = {}) {
  const status = options.status ?? 200;
  const contentType = options.contentType ?? 'application/json';
  const headers = {
    'content-type': contentType,
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
 * Wrap a mock value in a standard API response envelope.
 *
 * @param {unknown} data - The mock data to wrap
 * @param {Object} [options]
 * @param {number} [options.status=200] - HTTP status code
 * @param {string|null} [options.error=null] - Error message
 * @param {boolean} [options.timestamp=true] - Include timestamp
 * @returns {{ data: unknown, error: string|null, status: number, timestamp: string }}
 *
 * @example
 * const user = createMockFromFile('./types.ts', 'User');
 * const response = createApiResponse(user);
 * // → { data: {...}, error: null, status: 200, timestamp: "..." }
 */
function createApiResponse(data, options = {}) {
  return {
    data,
    error: options.error ?? null,
    status: options.status ?? 200,
    timestamp: options.timestamp !== false ? new Date().toISOString() : '',
  };
}

/**
 * Create a paginated API response.
 *
 * @param {Array} items - Array of mock items
 * @param {Object} [options]
 * @param {number} [options.page=1] - Current page
 * @param {number} [options.pageSize] - Items per page (defaults to items.length)
 * @param {number} [options.total] - Total items count (defaults to items.length)
 * @param {number} [options.status=200] - HTTP status code
 * @returns {{ data: Array, meta: { page: number, pageSize: number, total: number, totalPages: number }, status: number, timestamp: string }}
 *
 * @example
 * const users = createManyMocks('./types.ts', 'User', 10);
 * const response = createPaginatedResponse(users, { page: 1, pageSize: 10, total: 50 });
 */
function createPaginatedResponse(items, options = {}) {
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

module.exports = {
  createRouteResponse,
  createApiResponse,
  createPaginatedResponse,
};

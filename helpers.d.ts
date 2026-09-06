// Type definitions for typescript-types-mock/helpers

export interface RouteResponseOptions {
  /** HTTP status code (default: 200) */
  status?: number;
  /** Custom response headers */
  headers?: Record<string, string>;
  /** Content-Type header (default: "application/json") */
  contentType?: string;
}

export interface ApiResponseOptions {
  /** HTTP status code (default: 200) */
  status?: number;
  /** Error message (if any) */
  error?: string | null;
  /** Include timestamp (default: true) */
  timestamp?: boolean;
}

export interface PaginatedResponseOptions {
  /** Current page (default: 1) */
  page?: number;
  /** Items per page (defaults to items.length) */
  pageSize?: number;
  /** Total items count (defaults to items.length) */
  total?: number;
  /** HTTP status code (default: 200) */
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
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  status: number;
  timestamp: string;
}

/** Create a Playwright-compatible route.fulfill() response object. */
export declare function createRouteResponse(
  body: unknown,
  options?: RouteResponseOptions,
): RouteResponse;

/** Wrap a mock value in a standard API response envelope. */
export declare function createApiResponse<T = unknown>(
  data: T,
  options?: ApiResponseOptions,
): ApiResponse<T>;

/** Create a paginated API response. */
export declare function createPaginatedResponse<T = unknown>(
  items: T[],
  options?: PaginatedResponseOptions,
): PaginatedResponse<T>;

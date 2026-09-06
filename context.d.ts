// Type definitions for typescript-types-mock/context

import type { MockOptions } from './index';

/**
 * MockContext — caches the file path and default options for repeated mock generation.
 */
export declare class MockContext {
  constructor(filePath: string, defaultOptions?: Omit<MockOptions, 'filePath'>);

  /** The file path this context is bound to. */
  readonly filePath: string;

  /** Generate a single mock object. */
  mock(typeName: string, options?: Omit<MockOptions, 'filePath'>): any;

  /** Alias for mock(). */
  createMock(typeName: string, options?: Omit<MockOptions, 'filePath'>): any;

  /** Generate multiple mock objects. */
  many(typeName: string, count: number, options?: Omit<MockOptions, 'filePath'>): any[];

  /** Alias for many(). */
  createMany(typeName: string, count: number, options?: Omit<MockOptions, 'filePath'>): any[];

  /** List all available type names in the file. */
  listTypes(): string[];

  /** Generate a mock for a nested property path. */
  mockProperty(typeName: string, propertyPath: string, options?: Omit<MockOptions, 'filePath'>): any;
}

/** Create a MockContext bound to a file path. */
export declare function createMockContext(
  filePath: string,
  defaultOptions?: Omit<MockOptions, 'filePath'>,
): MockContext;

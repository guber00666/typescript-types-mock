// typescript-types-mock/context
// MockContext — caching wrapper around native mock generation.
// Parses the file once, reuses for subsequent mock calls.
//
// Usage:
//   const { MockContext, createMockContext } = require('typescript-types-mock/context');
//
// Or with ESM:
//   import { MockContext, createMockContext } from 'typescript-types-mock/context';

// Lazy-load native functions to avoid circular dependency with index.cjs
let _native = null;
function getNative() {
  if (!_native) {
    _native = require('./index.cjs');
  }
  return _native;
}

/**
 * MockContext — caches the file path and default options so you don't
 * have to pass them on every mock() call.
 *
 * @example
 * const ctx = createMockContext('./types.ts', { seed: 42 });
 * const user = ctx.mock('User');
 * const users = ctx.many('User', 10);
 * const types = ctx.listTypes();
 */
class MockContext {
  /**
   * @param {string} filePath - Path to the .ts file
   * @param {Object} [defaultOptions={}] - Default options for all mock() calls
   * @param {number} [defaultOptions.seed] - Random seed
   * @param {number} [defaultOptions.maxDepth] - Max object nesting depth
   * @param {number} [defaultOptions.arrayLength] - Default array length
   * @param {boolean} [defaultOptions.includeOptional] - Include optional properties
   * @param {Object} [defaultOptions.overrides] - Override specific field values
   */
  constructor(filePath, defaultOptions = {}) {
    this._filePath = filePath;
    this._defaultOptions = defaultOptions;
  }

  /** The file path this context is bound to. */
  get filePath() {
    return this._filePath;
  }

  /**
   * Generate a single mock object.
   *
   * @param {string} typeName - Name of the type/interface/enum to mock
   * @param {Object} [options={}] - Options (merged with defaults)
   * @returns {any} Mock object
   */
  mock(typeName, options = {}) {
    return getNative().createMockFromFile(this._filePath, typeName, {
      ...this._defaultOptions,
      ...options,
    });
  }

  /** Alias for mock(). */
  createMock(typeName, options = {}) {
    return this.mock(typeName, options);
  }

  /**
   * Generate multiple mock objects.
   *
   * @param {string} typeName - Name of the type/interface/enum to mock
   * @param {number} count - Number of mocks to generate
   * @param {Object} [options={}] - Options (merged with defaults)
   * @returns {Array<any>} Array of mock objects
   */
  many(typeName, count, options = {}) {
    return getNative().createManyMocks(this._filePath, typeName, count, {
      ...this._defaultOptions,
      ...options,
    });
  }

  /** Alias for many(). */
  createMany(typeName, count, options = {}) {
    return this.many(typeName, count, options);
  }

  /**
   * List all available type names in the file.
   *
   * @returns {string[]} Array of type names
   */
  listTypes() {
    return getNative().listTypes(this._filePath);
  }

  /**
   * Generate a mock for a nested property path.
   *
   * @param {string} typeName - Name of the root type
   * @param {string} propertyPath - Dot-separated path (e.g., "address.city")
   * @param {Object} [options={}] - Options (merged with defaults)
   * @returns {any} Value at the property path
   */
  mockProperty(typeName, propertyPath, options = {}) {
    const mock = this.mock(typeName, options);
    const parts = propertyPath.split('.');
    let current = mock;
    for (const part of parts) {
      if (current == null || typeof current !== 'object') return undefined;
      current = current[part];
    }
    return current;
  }
}

/**
 * Create a MockContext bound to a file path.
 *
 * @param {string} filePath - Path to the .ts file
 * @param {Object} [defaultOptions={}] - Default options
 * @returns {MockContext}
 */
function createMockContext(filePath, defaultOptions = {}) {
  return new MockContext(filePath, defaultOptions);
}

module.exports = {
  MockContext,
  createMockContext,
};

const test = require('ava')
const { createMockFromFile, createManyMocks, listTypes, mockFromSource, version } = require('../index.cjs')

test('version returns string', (t) => {
  const v = version()
  t.is(typeof v, 'string')
  t.true(v.length > 0)
})

test('mockFromSource generates valid mock', (t) => {
  const source = 'interface User { name: string; age: number; }'
  const mock = mockFromSource(source, 'User', { seed: 42 })
  t.is(typeof mock, 'object')
  t.is(typeof mock.name, 'string')
  t.is(typeof mock.age, 'number')
})

test('mockFromSource with overrides', (t) => {
  const source = 'interface User { name: string; age: number; }'
  const mock = mockFromSource(source, 'User', { seed: 42, overrides: { name: 'John' } })
  t.is(mock.name, 'John')
  t.is(typeof mock.age, 'number')
})

test('mockFromSource is deterministic with seed', (t) => {
  const source = 'interface User { name: string; age: number; }'
  const mock1 = mockFromSource(source, 'User', { seed: 42 })
  const mock2 = mockFromSource(source, 'User', { seed: 42 })
  t.deepEqual(mock1, mock2)
})

test('mockFromSource throws on unknown type', (t) => {
  const source = 'interface User { name: string; }'
  t.throws(() => {
    mockFromSource(source, 'Unknown', { seed: 42 })
  })
})

test('createMockFromFile generates mock from file', (t) => {
  const mock = createMockFromFile('./testdata/sample-types.ts', 'User', { seed: 42 })
  t.is(typeof mock, 'object')
  t.is(typeof mock.name, 'string')
  t.is(typeof mock.age, 'number')
  t.is(typeof mock.email, 'string')
  t.is(typeof mock.isActive, 'boolean')
})

test('createManyMocks generates multiple mocks', (t) => {
  const mocks = createManyMocks('./testdata/sample-types.ts', 'User', 5, { seed: 42 })
  t.is(mocks.length, 5)
  mocks.forEach((mock) => {
    t.is(typeof mock, 'object')
    t.is(typeof mock.name, 'string')
  })
})

test('listTypes returns array of type names', (t) => {
  const types = listTypes('./testdata/sample-types.ts')
  t.true(Array.isArray(types))
  t.true(types.length > 0)
  t.true(types.includes('User'))
  t.true(types.includes('BlogPost'))
})

test('handles nested interfaces', (t) => {
  const mock = createMockFromFile('./testdata/sample-types.ts', 'BlogPost', { seed: 42 })
  t.is(typeof mock, 'object')
  t.is(typeof mock.author, 'object')
  t.is(typeof mock.author.name, 'string')
  t.true(Array.isArray(mock.tags))
})

test('handles enum types', (t) => {
  const mock = createMockFromFile('./testdata/sample-types.ts', 'Color', { seed: 42 })
  t.is(typeof mock, 'string')
})

test('handles tuple types', (t) => {
  const mock = createMockFromFile('./testdata/sample-types.ts', 'Coordinate', { seed: 42 })
  t.true(Array.isArray(mock))
  t.is(mock.length, 2)
  t.is(typeof mock[0], 'number')
  t.is(typeof mock[1], 'number')
})

test('handles arrayLength option', (t) => {
  const source = 'type List = string[]'
  const mock = mockFromSource(source, 'List', { seed: 42, arrayLength: 5 })
  t.true(Array.isArray(mock))
  t.is(mock.length, 5)
})

import { test, expect, describe } from 'vitest'
import { generateSimpleSchema, parseSimpleFormatToZod, processJsonSchema } from '../../src/renderer/services/schema'
import { z } from 'zod'

describe('generateSimpleSchema', () => {
  test('handles primitive types', () => {
    expect(generateSimpleSchema('hello')).toBe('string')
    expect(generateSimpleSchema(42)).toBe('number')
    expect(generateSimpleSchema(true)).toBe('boolean')
    expect(generateSimpleSchema(false)).toBe('boolean')
  })

  test('handles null and undefined', () => {
    expect(generateSimpleSchema(null)).toBe('unknown')
    expect(generateSimpleSchema(undefined)).toBe('unknown')
  })

  test('handles empty arrays', () => {
    expect(generateSimpleSchema([])).toEqual([])
  })

  test('handles arrays of primitives', () => {
    expect(generateSimpleSchema(['a', 'b', 'c'])).toEqual(['string'])
    expect(generateSimpleSchema([1, 2, 3])).toEqual(['number'])
    expect(generateSimpleSchema([true, false])).toEqual(['boolean'])
  })

  test('handles mixed type arrays using first element', () => {
    expect(generateSimpleSchema([1, 'hello', true])).toEqual(['number'])
    expect(generateSimpleSchema(['hello', 1, true])).toEqual(['string'])
    expect(generateSimpleSchema([true, 'hello', 1])).toEqual(['boolean'])
  })

  test('handles simple objects', () => {
    const data = {
      name: 'John',
      age: 30,
      active: true
    }
    expect(generateSimpleSchema(data)).toEqual({
      name: 'string',
      age: 'number',
      active: 'boolean'
    })
  })

  test('handles nested objects', () => {
    const data = {
      user: {
        name: 'John',
        profile: {
          age: 30,
          verified: true
        }
      }
    }
    expect(generateSimpleSchema(data)).toEqual({
      user: {
        name: 'string',
        profile: {
          age: 'number',
          verified: 'boolean'
        }
      }
    })
  })

  test('handles arrays of objects', () => {
    const data = {
      items: [
        { id: 1, name: 'Item 1' },
        { id: 2, name: 'Item 2' }
      ]
    }
    expect(generateSimpleSchema(data)).toEqual({
      items: [{
        id: 'number',
        name: 'string'
      }]
    })
  })

  test('handles complex nested structures', () => {
    const data = {
      status: 'success',
      count: 5,
      items: [],
      data: {
        users: [
          { id: 1, name: 'John', tags: ['admin', 'user'] }
        ],
        metadata: {
          timestamp: '2024-01-01',
          version: 2,
          valid: true
        }
      }
    }
    expect(generateSimpleSchema(data)).toEqual({
      status: 'string',
      count: 'number',
      items: [],
      data: {
        users: [{
          id: 'number',
          name: 'string',
          tags: ['string']
        }],
        metadata: {
          timestamp: 'string',
          version: 'number',
          valid: 'boolean'
        }
      }
    })
  })

  test('handles objects with null/undefined values', () => {
    const data = {
      name: 'John',
      email: null,
      phone: undefined,
      age: 30
    }
    expect(generateSimpleSchema(data)).toEqual({
      name: 'string',
      email: 'unknown',
      phone: 'unknown',
      age: 'number'
    })
  })
})

test('parseSimpleFormatToZod handles simple string types', () => {
  expect(parseSimpleFormatToZod('string')).toBeInstanceOf(z.ZodString)
  expect(parseSimpleFormatToZod('number')).toBeInstanceOf(z.ZodNumber)
  expect(parseSimpleFormatToZod('boolean')).toBeInstanceOf(z.ZodBoolean)
  expect(parseSimpleFormatToZod('unknown')).toBeInstanceOf(z.ZodString)
})

test('parseSimpleFormatToZod handles array types', () => {
  expect(parseSimpleFormatToZod('string[]')).toBeInstanceOf(z.ZodArray)
  expect(parseSimpleFormatToZod('number[]')).toBeInstanceOf(z.ZodArray)
  expect(parseSimpleFormatToZod('boolean[]')).toBeInstanceOf(z.ZodArray)
})

test('parseSimpleFormatToZod handles literal values', () => {
  expect(parseSimpleFormatToZod('some literal')).toBeInstanceOf(z.ZodString)
  expect(parseSimpleFormatToZod(42)).toBeInstanceOf(z.ZodNumber)
  expect(parseSimpleFormatToZod(true)).toBeInstanceOf(z.ZodBoolean)
  expect(parseSimpleFormatToZod(false)).toBeInstanceOf(z.ZodBoolean)
})

test('parseSimpleFormatToZod handles complex nested object with all types', () => {
  const complexStructure = {
    user: {
      id: 'number',
      name: 'string',
      email: 'string',
      isActive: 'boolean',
      tags: 'string[]',
      scores: 'number[]',
      preferences: 'boolean[]',
      profile: {
        age: 'number',
        bio: 'string',
        isPublic: 'boolean',
        socialLinks: ['string'],
        achievements: [{
          title: 'string',
          year: 'number',
          verified: 'boolean'
        }],
        metadata: {
          createdAt: 'string',
          updatedAt: 'string',
          version: 'number'
        }
      }
    },
    settings: {
      theme: 'string',
      notifications: 'boolean',
      limits: 'number[]'
    }
  }

  const result = parseSimpleFormatToZod(complexStructure)

  // Test that we get a Zod object
  expect(result).toBeInstanceOf(z.ZodObject)

  // Test validation with valid data
  const validData = {
    user: {
      id: 123,
      name: 'John Doe',
      email: 'john@example.com',
      isActive: true,
      tags: ['developer', 'admin'],
      scores: [95, 87, 92],
      preferences: [true, false, true],
      profile: {
        age: 30,
        bio: 'Software developer',
        isPublic: true,
        socialLinks: ['https://github.com/johndoe'],
        achievements: [
          { title: 'Expert Developer', year: 2023, verified: true },
          { title: 'Team Lead', year: 2024, verified: false }
        ],
        metadata: {
          createdAt: '2023-01-01',
          updatedAt: '2024-01-01',
          version: 2
        }
      }
    },
    settings: {
      theme: 'dark',
      notifications: true,
      limits: [100, 500, 1000]
    }
  }

  expect(() => result.parse(validData)).not.toThrow()

  // Test validation fails with invalid data
  const invalidData = {
    user: {
      id: 'not-a-number', // should be number
      name: 'John Doe',
      email: 'john@example.com',
      isActive: true,
      tags: ['developer', 'admin'],
      scores: [95, 87, 92],
      preferences: [true, false, true],
      profile: {
        age: 30,
        bio: 'Software developer',
        isPublic: true,
        socialLinks: ['https://github.com/johndoe'],
        achievements: [
          { title: 'Expert Developer', year: 2023, verified: true }
        ],
        metadata: {
          createdAt: '2023-01-01',
          updatedAt: '2024-01-01',
          version: 2
        }
      }
    },
    settings: {
      theme: 'dark',
      notifications: true,
      limits: [100, 500, 1000]
    }
  }

  expect(() => result.parse(invalidData)).toThrow()
})

test('parseSimpleFormatToZod handles arrays with structure', () => {
  const arrayStructure = [{
    id: 'number',
    name: 'string'
  }]
  
  const result = parseSimpleFormatToZod(arrayStructure)
  expect(result).toBeInstanceOf(z.ZodArray)
  
  // Test valid array data
  const validArray = [
    { id: 1, name: 'Item 1' },
    { id: 2, name: 'Item 2' }
  ]
  expect(() => result.parse(validArray)).not.toThrow()
  
  // Test invalid array data
  const invalidArray = [
    { id: 'not-a-number', name: 'Item 1' }
  ]
  expect(() => result.parse(invalidArray)).toThrow()
})

test('parseSimpleFormatToZod handles null values', () => {
  expect(parseSimpleFormatToZod(null)).toBeInstanceOf(z.ZodString)
})

test('parseSimpleFormatToZod handles undefined values', () => {
  expect(parseSimpleFormatToZod(undefined)).toBeInstanceOf(z.ZodString)
})

test('parseSimpleFormatToZod handles empty objects', () => {
  const result = parseSimpleFormatToZod({})
  expect(result).toBeInstanceOf(z.ZodObject)
  expect(() => result.parse({})).not.toThrow()
})

test('parseSimpleFormatToZod handles empty arrays', () => {
  const result = parseSimpleFormatToZod([])
  expect(result).toBeInstanceOf(z.ZodArray)
  // Empty array structure defaults to string array
  expect(() => result.parse(['test'])).not.toThrow()
})

test('parseSimpleFormatToZod handles formal JSON specifications', () => {

  const formalSpec = {
    type: 'object',
    properties: {
      name: { type: 'string' },
      age: { type: 'number', minimum: 0 },
    },
    required: ['name', 'age'],
  }

  const result = parseSimpleFormatToZod(formalSpec)
  expect(() => result.parse({
    name: 'test',
    age: 12
  })).not.toThrow()

})

test('processJsonSchema returns structured output for valid JSON', () => {
  const jsonSchema = JSON.stringify({
    name: 'string',
    age: 'number',
    active: 'boolean'
  })
  
  const result = processJsonSchema('test-schema', jsonSchema)
  
  expect(result).not.toBeNull()
  expect(result?.name).toBe('test-schema')
  expect(result?.structure).toBeInstanceOf(z.ZodType)
})

test('processJsonSchema returns null for undefined schema', () => {
  const result = processJsonSchema('test-schema', undefined)
  expect(result).toBeNull()
})

test('processJsonSchema returns null for empty schema', () => {
  const result = processJsonSchema('test-schema', '')
  expect(result).toBeNull()
})

test('processJsonSchema handles invalid JSON gracefully', () => {
  const result = processJsonSchema('test-schema', '{ invalid json }')
  expect(result).toBeNull()
})

test('processJsonSchema handles complex valid JSON schema', () => {
  const complexSchema = {
    response: {
      success: 'boolean',
      data: {
        items: [{
          id: 'number',
          title: 'string',
          tags: 'string[]'
        }],
        metadata: {
          count: 'number',
          hasMore: 'boolean'
        }
      },
      errors: 'string[]'
    }
  }
  
  const result = processJsonSchema('complex-schema', JSON.stringify(complexSchema))
  
  expect(result).not.toBeNull()
  expect(result?.name).toBe('complex-schema')
  expect(result?.structure).toBeInstanceOf(z.ZodType)
  
  // Test with valid data
  const validData = {
    response: {
      success: true,
      data: {
        items: [
          { id: 1, title: 'First Item', tags: ['tag1', 'tag2'] },
          { id: 2, title: 'Second Item', tags: ['tag3'] }
        ],
        metadata: {
          count: 2,
          hasMore: false
        }
      },
      errors: []
    }
  }
  
  expect(() => result?.structure.parse(validData)).not.toThrow()
})

test('processJsonSchema handles malformed JSON with proper error logging', () => {

  // Test various malformed JSON cases
  const malformedCases = [
    '{ "key": }',
    '{ key: "value" }', // unquoted key
    '{ "key": "value", }', // trailing comma
    '[1, 2, 3,]', // trailing comma in array
    'undefined',
    'function() {}',
    '{ "key": undefined }'
  ]
  
  malformedCases.forEach(malformedJson => {
    const result = processJsonSchema('test-schema', malformedJson)
    expect(result).toBeNull()
  })
})

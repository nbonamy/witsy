import { test, expect, describe } from 'vitest'
import { jsonSchemaToZod, convertToolToAgentsFormat, buildRealtimeTools } from '@services/realtime_tools'
import { LlmTool, Plugin, LlmEngine, PluginParameter, PluginExecutionContext, ChatModel } from 'multi-llm-ts'

describe('jsonSchemaToZod', () => {

  test('converts string type', () => {
    const schema = { type: 'string' }
    const zodSchema = jsonSchemaToZod(schema)
    expect(zodSchema._def.typeName).toBe('ZodString')
  })

  test('converts string type with description', () => {
    const schema = { type: 'string', description: 'A test string' }
    const zodSchema = jsonSchemaToZod(schema)
    expect(zodSchema._def.typeName).toBe('ZodString')
    expect(zodSchema.description).toBe('A test string')
  })

  test('converts string enum', () => {
    const schema = { type: 'string', enum: ['a', 'b', 'c'] }
    const zodSchema = jsonSchemaToZod(schema)
    expect(zodSchema._def.typeName).toBe('ZodEnum')
    expect(zodSchema._def.values).toEqual(['a', 'b', 'c'])
  })

  test('converts number type', () => {
    const schema = { type: 'number' }
    const zodSchema = jsonSchemaToZod(schema)
    expect(zodSchema._def.typeName).toBe('ZodNumber')
  })

  test('converts integer type', () => {
    const schema = { type: 'integer' }
    const zodSchema = jsonSchemaToZod(schema)
    expect(zodSchema._def.typeName).toBe('ZodNumber')
  })

  test('converts boolean type', () => {
    const schema = { type: 'boolean' }
    const zodSchema = jsonSchemaToZod(schema)
    expect(zodSchema._def.typeName).toBe('ZodBoolean')
  })

  test('converts array type', () => {
    const schema = { type: 'array', items: { type: 'string' } }
    const zodSchema = jsonSchemaToZod(schema)
    expect(zodSchema._def.typeName).toBe('ZodArray')
  })

  test('converts object type', () => {
    const schema = {
      type: 'object',
      properties: {
        name: { type: 'string' },
        age: { type: 'number' }
      },
      required: ['name']
    }
    const zodSchema = jsonSchemaToZod(schema)
    expect(zodSchema._def.typeName).toBe('ZodObject')

    // Validate that parsing works correctly
    const validResult = zodSchema.safeParse({ name: 'John', age: 30 })
    expect(validResult.success).toBe(true)

    // Name is required
    const invalidResult = zodSchema.safeParse({ age: 30 })
    expect(invalidResult.success).toBe(false)

    // Age is optional
    const optionalResult = zodSchema.safeParse({ name: 'John' })
    expect(optionalResult.success).toBe(true)
  })

  test('handles nested objects', () => {
    const schema = {
      type: 'object',
      properties: {
        user: {
          type: 'object',
          properties: {
            name: { type: 'string' }
          },
          required: ['name']
        }
      },
      required: ['user']
    }
    const zodSchema = jsonSchemaToZod(schema)

    const validResult = zodSchema.safeParse({ user: { name: 'John' } })
    expect(validResult.success).toBe(true)
  })

  test('falls back to any for unknown types', () => {
    const schema = { type: 'unknown' }
    const zodSchema = jsonSchemaToZod(schema)
    expect(zodSchema._def.typeName).toBe('ZodAny')
  })

})

describe('convertToolToAgentsFormat', () => {

  const mockModel: ChatModel = {
    id: 'test-model',
    name: 'Test Model',
    capabilities: {}
  }

  class TestPlugin extends Plugin {
    getName(): string {
      return 'test_plugin'
    }
    getDescription(): string {
      return 'A test plugin'
    }
    getParameters(): PluginParameter[] {
      return []
    }
    async execute(_context: PluginExecutionContext, params: any): Promise<any> {
      return { result: 'executed', params }
    }
  }

  test('converts LlmTool to Agent SDK format', () => {
    const llmTool: LlmTool = {
      type: 'function',
      function: {
        name: 'test_function',
        description: 'A test function',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' }
          },
          required: ['query']
        }
      }
    }

    const plugin = new TestPlugin({} as any, 'test-workspace')
    const agentTool = convertToolToAgentsFormat(llmTool, plugin, mockModel)

    expect(agentTool.name).toBe('test_function')
    expect(agentTool.description).toBe('A test function')
  })

  test('tool has correct properties', () => {
    const llmTool: LlmTool = {
      type: 'function',
      function: {
        name: 'test_function',
        description: 'A test function',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string' }
          },
          required: ['query']
        }
      }
    }

    const plugin = new TestPlugin({} as any, 'test-workspace')
    const agentTool = convertToolToAgentsFormat(llmTool, plugin, mockModel)

    // Verify tool has expected structure
    expect(agentTool.name).toBe('test_function')
    expect(agentTool.description).toBe('A test function')
    expect(typeof agentTool.invoke).toBe('function')
  })

})

describe('buildRealtimeTools', () => {

  const mockModel: ChatModel = {
    id: 'test-model',
    name: 'Test Model',
    capabilities: {}
  }

  test('builds tools from engine plugins', async () => {
    // Create a mock plugin
    class MockPlugin extends Plugin {
      getName(): string {
        return 'mock_plugin'
      }
      getDescription(): string {
        return 'A mock plugin'
      }
      getParameters(): PluginParameter[] {
        return [
          { name: 'input', type: 'string', description: 'Input value', required: true }
        ]
      }
      isEnabled(): boolean {
        return true
      }
      serializeInTools(): boolean {
        return true
      }
      async execute(_context: PluginExecutionContext, params: any): Promise<any> {
        return { result: params.input }
      }
    }

    // Create a mock engine with the plugin
    const mockEngine = {
      plugins: [new MockPlugin({} as any, 'test-workspace')]
    } as unknown as LlmEngine

    const tools = await buildRealtimeTools(mockEngine, mockModel)

    expect(tools).toHaveLength(1)
    expect(tools[0].name).toBe('mock_plugin')
  })

  test('skips disabled plugins', async () => {
    class DisabledPlugin extends Plugin {
      getName(): string {
        return 'disabled_plugin'
      }
      getDescription(): string {
        return 'A disabled plugin'
      }
      getParameters(): PluginParameter[] {
        return []
      }
      isEnabled(): boolean {
        return false
      }
      serializeInTools(): boolean {
        return true
      }
      async execute(): Promise<any> {
        return {}
      }
    }

    const mockEngine = {
      plugins: [new DisabledPlugin({} as any, 'test-workspace')]
    } as unknown as LlmEngine

    const tools = await buildRealtimeTools(mockEngine, mockModel)

    expect(tools).toHaveLength(0)
  })

  test('skips plugins that do not serialize in tools', async () => {
    class NoSerializePlugin extends Plugin {
      getName(): string {
        return 'no_serialize_plugin'
      }
      getDescription(): string {
        return 'A plugin that does not serialize'
      }
      getParameters(): PluginParameter[] {
        return []
      }
      isEnabled(): boolean {
        return true
      }
      serializeInTools(): boolean {
        return false
      }
      async execute(): Promise<any> {
        return {}
      }
    }

    const mockEngine = {
      plugins: [new NoSerializePlugin({} as any, 'test-workspace')]
    } as unknown as LlmEngine

    const tools = await buildRealtimeTools(mockEngine, mockModel)

    expect(tools).toHaveLength(0)
  })

})

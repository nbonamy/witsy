import { vi, expect, test, beforeEach, describe, beforeAll } from 'vitest'
import { Plugin, MultiToolPlugin } from 'multi-llm-ts'
import { useWindowMock } from '../../mocks/window'
import { createI18nMock } from '../../mocks'
import CodeExecutionProxyPlugin from '../../../src/renderer/services/plugins/code_exec_proxy'
import { kCodeExecutionPluginPrefix } from '../../../src/renderer/services/plugins/code_exec_base'

vi.mock('../../../src/renderer/services/i18n', async () => {
  return createI18nMock()
})

// Mock plugin for testing
class MockPlugin extends Plugin {
  private mockExecute: any
  private pluginName: string

  constructor(name: string, mockExecute: any) {
    super()
    this.pluginName = name
    this.mockExecute = mockExecute
  }

  getName(): string {
    return this.pluginName
  }

  getDescription(): string {
    return `Mock plugin ${this.pluginName}`
  }

  getParameters(): any[] {
    return []
  }

  getRunningDescription(): string {
    return `Running ${this.pluginName}`
  }

  async execute(context: any, parameters: any): Promise<any> {
    return this.mockExecute(context, parameters)
  }
}

describe('CodeExecutionProxyPlugin', () => {
  let plugin: CodeExecutionProxyPlugin
  let mockEngine: any

  beforeAll(() => {
    useWindowMock()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    plugin = new CodeExecutionProxyPlugin()

    mockEngine = {
      plugins: [],
      getAvailableTools: vi.fn().mockResolvedValue([]),
      clearPlugins: vi.fn(),
      addPlugin: vi.fn()
    }
  })

  describe('Plugin Configuration', () => {
    test('isEnabled returns true', () => {
      expect(plugin.isEnabled()).toBe(true)
    })

    test('getName returns execute_code_proxy', () => {
      expect(plugin.getName()).toBe('execute_code_proxy')
    })

    test('handlesTool returns true for prefixed tools', () => {
      expect(plugin.handlesTool(`${kCodeExecutionPluginPrefix}call_tool`)).toBe(true)
      expect(plugin.handlesTool(`${kCodeExecutionPluginPrefix}get_tools_info`)).toBe(true)
      expect(plugin.handlesTool('other_tool')).toBe(false)
    })
  })

  describe('Installation', () => {
    test('install captures plugins and tools', async () => {
      const mockPlugins = [
        new MockPlugin('test_tool', () => ({ result: 'ok' }))
      ]
      const mockTools = [
        {
          type: 'function',
          function: {
            name: 'test_tool',
            description: 'Test tool',
            parameters: { type: 'object', properties: {}, required: [] }
          }
        }
      ]

      mockEngine.plugins = mockPlugins
      mockEngine.getAvailableTools.mockResolvedValue(mockTools)

      await plugin.install(mockEngine)

      expect(mockEngine.clearPlugins).toHaveBeenCalled()
      expect(mockEngine.addPlugin).toHaveBeenCalledWith(plugin)
    })

    test('getTools returns call_tool and get_tools_info', async () => {
      const tools = await plugin.getTools()
      expect(tools).toHaveLength(2)
      expect(tools[0].function.name).toBe(`${kCodeExecutionPluginPrefix}call_tool`)
      expect(tools[1].function.name).toBe(`${kCodeExecutionPluginPrefix}get_tools_info`)
    })
  })

  describe('get_tools_info tool', () => {
    beforeEach(async () => {
      const mockPlugins = [
        new MockPlugin('search', () => ({ results: [] })),
        new MockPlugin('calculator', () => ({ value: 0 }))
      ]
      const mockTools = [
        {
          type: 'function' as const,
          function: {
            name: 'search',
            description: 'Search the web',
            parameters: {
              type: 'object' as const,
              properties: { query: { type: 'string' } },
              required: ['query']
            }
          }
        },
        {
          type: 'function' as const,
          function: {
            name: 'calculator',
            description: 'Perform calculations',
            parameters: {
              type: 'object' as const,
              properties: { expression: { type: 'string' } },
              required: ['expression']
            }
          }
        }
      ]

      mockEngine.plugins = mockPlugins
      mockEngine.getAvailableTools.mockResolvedValue(mockTools)
      await plugin.install(mockEngine)
    })

    test('returns info for requested tools', async () => {
      const result = await plugin.execute({}, {
        tool: `${kCodeExecutionPluginPrefix}get_tools_info`,
        parameters: {
          tools_names: ['search', 'calculator']
        }
      })

      expect(result.tools_info).toHaveLength(2)
      expect(result.tools_info[0].name).toBe('search')
      expect(result.tools_info[0].description).toBe('Search the web')
      expect(result.tools_info[1].name).toBe('calculator')
      expect(result.tools_info[1].description).toBe('Perform calculations')
    })

    test('returns error for unknown tool', async () => {
      const result = await plugin.execute({}, {
        tool: `${kCodeExecutionPluginPrefix}get_tools_info`,
        parameters: {
          tools_names: ['unknown_tool']
        }
      })

      expect(result.tools_info).toHaveLength(1)
      expect(result.tools_info[0].error).toBe('Tool "unknown_tool" not found')
    })
  })

  describe('call_tool - Basic Execution', () => {
    beforeEach(async () => {
      const mockPlugins = [
        new MockPlugin('calculator', (context: any, params: any) => {
          return { result: eval(params.expression) }
        }),
        new MockPlugin('echo', (context: any, params: any) => {
          return { result: params.message }
        })
      ]
      const mockTools = [
        {
          type: 'function' as const,
          function: {
            name: 'calculator',
            description: 'Perform calculations',
            parameters: {
              type: 'object' as const,
              properties: { expression: { type: 'string' } },
              required: ['expression']
            }
          }
        },
        {
          type: 'function' as const,
          function: {
            name: 'echo',
            description: 'Echo a message',
            parameters: {
              type: 'object' as const,
              properties: { message: { type: 'string' } },
              required: ['message']
            }
          }
        }
      ]

      mockEngine.plugins = mockPlugins
      mockEngine.getAvailableTools.mockResolvedValue(mockTools)
      await plugin.install(mockEngine)
    })

    test('executes a simple tool call', async () => {
      const result = await plugin.execute({}, {
        tool: `${kCodeExecutionPluginPrefix}call_tool`,
        parameters: {
          tool_name: 'calculator',
          parameters: { expression: '2 + 2' }
        }
      })

      expect(result).toEqual({ result: 4 })
    })

    test('executes echo tool', async () => {
      const result = await plugin.execute({}, {
        tool: `${kCodeExecutionPluginPrefix}call_tool`,
        parameters: {
          tool_name: 'echo',
          parameters: { message: 'Hello, World!' }
        }
      })

      expect(result).toEqual({ result: 'Hello, World!' })
    })

    test('returns error for unknown tool', async () => {
      const result = await plugin.execute({}, {
        tool: `${kCodeExecutionPluginPrefix}call_tool`,
        parameters: {
          tool_name: 'unknown_tool',
          parameters: {}
        }
      })

      expect(result.error).toBe('Tool "unknown_tool" not found')
    })
  })

  describe('call_tool - Result Unwrapping', () => {
    beforeEach(async () => {
      const mockPlugins = [
        new MockPlugin('wrapper', () => {
          return { result: { data: { value: 42 } } }
        }),
        new MockPlugin('direct', () => {
          return { result: 'direct result' }
        })
      ]
      const mockTools = [
        {
          type: 'function' as const,
          function: {
            name: 'wrapper',
            description: 'Returns wrapped data',
            parameters: { type: 'object' as const, properties: {}, required: [] }
          }
        },
        {
          type: 'function' as const,
          function: {
            name: 'direct',
            description: 'Returns direct result',
            parameters: { type: 'object' as const, properties: {}, required: [] }
          }
        }
      ]

      mockEngine.plugins = mockPlugins
      mockEngine.getAvailableTools.mockResolvedValue(mockTools)
      await plugin.install(mockEngine)
    })

    test('returns wrapped result as-is (does not unwrap .data)', async () => {
      const result = await plugin.execute({}, {
        tool: `${kCodeExecutionPluginPrefix}call_tool`,
        parameters: {
          tool_name: 'wrapper',
          parameters: {}
        }
      })

      // Pure passthrough - returns exactly what the plugin returns
      expect(result).toEqual({ result: { data: { value: 42 } } })
    })

    test('returns direct result as-is from plugin', async () => {
      const result = await plugin.execute({}, {
        tool: `${kCodeExecutionPluginPrefix}call_tool`,
        parameters: {
          tool_name: 'direct',
          parameters: {}
        }
      })

      // Pure passthrough - returns exactly what the plugin returns
      expect(result).toEqual({ result: 'direct result' })
    })
  })

  describe('call_tool - MultiToolPlugin Support', () => {
    class MockMultiToolPlugin extends MultiToolPlugin {
      constructor(private mockExecute: any) {
        super()
      }

      getName(): string {
        return 'multi_tool'
      }

      handlesTool(name: string): boolean {
        return name.startsWith('multi_')
      }

      async execute(context: any, parameters: any): Promise<any> {
        return this.mockExecute(context, parameters)
      }
    }

    beforeEach(async () => {
      const multiToolPlugin = new MockMultiToolPlugin((context: any, params: any) => {
        if (params.tool === 'multi_add') {
          return { result: params.parameters.a + params.parameters.b }
        }
        return { result: null }
      })

      const mockPlugins = [multiToolPlugin]
      const mockTools = [
        {
          type: 'function' as const,
          function: {
            name: 'multi_add',
            description: 'Add two numbers',
            parameters: {
              type: 'object' as const,
              properties: {
                a: { type: 'number' },
                b: { type: 'number' }
              },
              required: ['a', 'b']
            }
          }
        }
      ]

      mockEngine.plugins = mockPlugins
      mockEngine.getAvailableTools.mockResolvedValue(mockTools)
      await plugin.install(mockEngine)
    })

    test('executes multi-tool plugin tool', async () => {
      const result = await plugin.execute({}, {
        tool: `${kCodeExecutionPluginPrefix}call_tool`,
        parameters: {
          tool_name: 'multi_add',
          parameters: { a: 5, b: 3 }
        }
      })

      // Pure passthrough - returns exactly what the plugin returns
      expect(result).toEqual({ result: 8 })
    })
  })

  describe('Unknown Tool Handling', () => {
    test('returns error for unknown tool in execute', async () => {
      const result = await plugin.execute({}, {
        tool: 'unknown_tool',
        parameters: {}
      })

      expect(result.error).toBe('Tool "unknown_tool" not found')
    })
  })
})

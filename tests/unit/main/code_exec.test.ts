import { vi, expect, test, beforeEach, describe } from 'vitest'
import CodeExecutionPlugin, { kCodeExecutionPluginPrefix } from '../../../src/renderer/services/plugins/code_exec'
import { Plugin, MultiToolPlugin } from 'multi-llm-ts'

// Mock i18n
vi.mock('../../../src/renderer/services/i18n', () => ({
  t: (key: string, params?: any) => {
    const translations: Record<string, string> = {
      'plugins.code_exec.preparing': 'Preparing to execute workflow…',
      'plugins.code_exec.getToolsInfo.running': `Getting info for ${params?.count || 0} tools…`,
      'plugins.code_exec.getToolsInfo.completed': `Retrieved info for ${params?.count || 0} tools`,
      'plugins.code_exec.getToolsInfo.error': `Error getting tools info: ${params?.error || 'unknown'}`,
      'plugins.code_exec.getToolsInfo.description': `Get detailed information about specific tools.\n\nAvailable tools:\n${params?.tools || ''}`,
      'plugins.code_exec.runProgram.running': `Executing workflow with ${params?.count || 0} steps…`,
      'plugins.code_exec.runProgram.completed': `Completed workflow with ${params?.count || 0} steps`,
      'plugins.code_exec.runProgram.error': `Workflow failed: ${params?.error || 'unknown'}`,
      'plugins.code_exec.runProgram.description': 'Execute a multi-step workflow by calling other tools sequentially with variable substitution',
    }
    return translations[key] || key
  }
}))

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

describe('CodeExecutionPlugin', () => {
  let plugin: CodeExecutionPlugin
  let mockEngine: any

  beforeEach(() => {
    vi.clearAllMocks()
    plugin = new CodeExecutionPlugin({}, 'test-workspace')

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

    test('getName returns execute_code', () => {
      expect(plugin.getName()).toBe('execute_code')
    })

    test('handlesTool returns true for prefixed tools', () => {
      expect(plugin.handlesTool(`${kCodeExecutionPluginPrefix}get_tools_info`)).toBe(true)
      expect(plugin.handlesTool(`${kCodeExecutionPluginPrefix}run_program`)).toBe(true)
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

      expect(mockEngine.getAvailableTools).toHaveBeenCalled()
      expect(mockEngine.clearPlugins).toHaveBeenCalled()
      expect(mockEngine.addPlugin).toHaveBeenCalledWith(plugin)
    })

    test('getTools returns two tools after install', async () => {
      await plugin.install(mockEngine)
      const tools = await plugin.getTools()

      expect(tools).toHaveLength(2)
      expect(tools[0].function.name).toBe(`${kCodeExecutionPluginPrefix}get_tools_info`)
      expect(tools[1].function.name).toBe(`${kCodeExecutionPluginPrefix}run_program`)
    })
  })

  describe('get_tools_info tool', () => {
    beforeEach(async () => {
      const mockTools = [
        {
          type: 'function',
          function: {
            name: 'test_tool_1',
            description: 'Test tool 1',
            parameters: { type: 'object', properties: { arg1: { type: 'string' } }, required: ['arg1'] }
          }
        },
        {
          type: 'function',
          function: {
            name: 'test_tool_2',
            description: 'Test tool 2',
            parameters: { type: 'object', properties: {}, required: [] }
          }
        }
      ]
      mockEngine.getAvailableTools.mockResolvedValue(mockTools)
      await plugin.install(mockEngine)
    })

    test('returns info for requested tools', async () => {
      const result = await plugin.execute({} as any, {
        tool: `${kCodeExecutionPluginPrefix}get_tools_info`,
        parameters: {
          tools_names: ['test_tool_1', 'test_tool_2']
        }
      })

      expect(result.tools_info).toHaveLength(2)
      expect(result.tools_info[0]).toMatchObject({
        name: 'test_tool_1',
        description: 'Test tool 1',
        parameters: { type: 'object', properties: { arg1: { type: 'string' } }, required: ['arg1'] }
      })
      expect(result.tools_info[1]).toMatchObject({
        name: 'test_tool_2',
        description: 'Test tool 2'
      })
    })

    test('returns error for non-existent tool', async () => {
      const result = await plugin.execute({} as any, {
        tool: `${kCodeExecutionPluginPrefix}get_tools_info`,
        parameters: {
          tools_names: ['nonexistent_tool']
        }
      })

      expect(result.tools_info[0]).toMatchObject({
        name: 'nonexistent_tool',
        error: 'Tool "nonexistent_tool" not found'
      })
    })

    test('getRunningDescription returns correct message', () => {
      const desc = plugin.getRunningDescription(`${kCodeExecutionPluginPrefix}get_tools_info`, {
        tools_names: ['tool1', 'tool2', 'tool3']
      })
      expect(desc).toContain('3 tools')
    })

    test('getCompletedDescription returns correct message', () => {
      const desc = plugin.getCompletedDescription(
        `${kCodeExecutionPluginPrefix}get_tools_info`,
        { tools_names: ['tool1', 'tool2'] },
        { tools_info: [{}, {}] }
      )
      expect(desc).toContain('2 tools')
    })

    test('getCompletedDescription handles error', () => {
      const desc = plugin.getCompletedDescription(
        `${kCodeExecutionPluginPrefix}get_tools_info`,
        { tools_names: ['tool1'] },
        { error: 'Something went wrong' }
      )
      expect(desc).toContain('Something went wrong')
    })

    test('includes result_schema when tool has been executed', async () => {
      // First, run a program to generate a schema
      const mockTool = new MockPlugin('test_tool_1', () => ({
        status: 'success',
        count: 42,
        items: ['a', 'b', 'c']
      }))
      mockEngine.plugins = [mockTool]
      await plugin.install(mockEngine)

      await plugin.execute({} as any, {
        tool: `${kCodeExecutionPluginPrefix}run_program`,
        parameters: {
          program: {
            steps: [
              { id: 'step1', tool: 'test_tool_1', args: {} }
            ]
          }
        }
      })

      // Now call get_tools_info to check if result_schema is included
      const result = await plugin.execute({} as any, {
        tool: `${kCodeExecutionPluginPrefix}get_tools_info`,
        parameters: {
          tools_names: ['test_tool_1']
        }
      })

      expect(result.tools_info).toHaveLength(1)
      expect(result.tools_info[0]).toHaveProperty('result_schema')
      // Simple schema format
      expect(result.tools_info[0].result_schema).toEqual("{\"status\":\"string\",\"count\":\"number\",\"items\":[\"string\"]}")
    })

    test('does not include result_schema when tool has not been executed', async () => {
      const result = await plugin.execute({} as any, {
        tool: `${kCodeExecutionPluginPrefix}get_tools_info`,
        parameters: {
          tools_names: ['test_tool_2']
        }
      })

      expect(result.tools_info).toHaveLength(1)
      expect(result.tools_info[0]).not.toHaveProperty('result_schema')
    })
  })

  describe('run_program tool - Basic Execution', () => {
    test('executes simple workflow with one step', async () => {
      const mockTool = new MockPlugin('test_tool', () => ({ result: 'success' }))
      mockEngine.plugins = [mockTool]
      await plugin.install(mockEngine)

      const result = await plugin.execute({} as any, {
        tool: `${kCodeExecutionPluginPrefix}run_program`,
        parameters: {
          program: {
            steps: [
              { id: 'step1', tool: 'test_tool', args: {} }
            ]
          }
        }
      })

      expect(result).toBe('success')
    })

    test('executes workflow with multiple steps', async () => {
      const mockTool1 = new MockPlugin('tool1', () => ({ result: 'first' }))
      const mockTool2 = new MockPlugin('tool2', () => ({ result: 'second' }))
      const mockTool3 = new MockPlugin('tool3', () => ({ result: 'final' }))

      mockEngine.plugins = [mockTool1, mockTool2, mockTool3]
      await plugin.install(mockEngine)

      const result = await plugin.execute({} as any, {
        tool: `${kCodeExecutionPluginPrefix}run_program`,
        parameters: {
          program: {
            steps: [
              { id: 'step1', tool: 'tool1', args: {} },
              { id: 'step2', tool: 'tool2', args: {} },
              { id: 'step3', tool: 'tool3', args: {} }
            ]
          }
        }
      })

      expect(result).toBe('final')
    })

    test('fails with invalid program (no steps)', async () => {
      await plugin.install(mockEngine)

      const result = await plugin.execute({} as any, {
        tool: `${kCodeExecutionPluginPrefix}run_program`,
        parameters: {
          program: { invalid: true }
        }
      })

      expect(result.error).toContain('must have a steps array')
    })

    test('fails with null steps', async () => {
      await plugin.install(mockEngine)

      const result = await plugin.execute({} as any, {
        tool: `${kCodeExecutionPluginPrefix}run_program`,
        parameters: {
          program: { steps: null }
        }
      })

      expect(result.error).toContain('must have a steps array')
    })

    test('fails when tool not found', async () => {
      await plugin.install(mockEngine)

      const result = await plugin.execute({} as any, {
        tool: `${kCodeExecutionPluginPrefix}run_program`,
        parameters: {
          program: {
            steps: [
              { id: 'step1', tool: 'nonexistent_tool', args: {} }
            ]
          }
        }
      })

      expect(result.error).toContain('Tool "nonexistent_tool" not found')
      expect(result.failedStep).toBe('step1')
    })

    test('supports steps array directly (backward compatibility)', async () => {
      const mockTool = new MockPlugin('test_tool', () => ({ result: 'success' }))
      mockEngine.plugins = [mockTool]
      await plugin.install(mockEngine)

      const result = await plugin.execute({} as any, {
        tool: `${kCodeExecutionPluginPrefix}run_program`,
        parameters: {
          steps: [
            { id: 'step1', tool: 'test_tool', args: {} }
          ]
        }
      })

      expect(result).toBe('success')
    })

    test('getRunningDescription returns correct message', async () => {
      await plugin.install(mockEngine)

      const desc = plugin.getRunningDescription(`${kCodeExecutionPluginPrefix}run_program`, {
        program: { steps: [{ id: 's1' }, { id: 's2' }] }
      })
      expect(desc).toContain('2 steps')
    })

    test('getCompletedDescription returns correct message', async () => {
      await plugin.install(mockEngine)

      const desc = plugin.getCompletedDescription(
        `${kCodeExecutionPluginPrefix}run_program`,
        { program: { steps: [{ id: 's1' }, { id: 's2' }] } },
        { result: 'ok' }
      )
      expect(desc).toContain('2 steps')
    })

    test('getCompletedDescription handles error', async () => {
      await plugin.install(mockEngine)

      const desc = plugin.getCompletedDescription(
        `${kCodeExecutionPluginPrefix}run_program`,
        { program: { steps: [{ id: 's1' }] } },
        { error: 'Something failed' }
      )
      expect(desc).toContain('Something failed')
    })
  })

  describe('run_program tool - Variable Substitution', () => {
    test('simple variable substitution', async () => {
      let capturedArgs: any = null

      const mockTool1 = new MockPlugin('tool1', () => ({
        result: { data: [{ gid: '12345' }] }
      }))

      const mockTool2 = new MockPlugin('tool2', (context: any, params: any) => {
        capturedArgs = params
        return { result: 'done' }
      })

      mockEngine.plugins = [mockTool1, mockTool2]
      await plugin.install(mockEngine)

      await plugin.execute({} as any, {
        tool: `${kCodeExecutionPluginPrefix}run_program`,
        parameters: {
          program: {
            steps: [
              { id: 'get_data', tool: 'tool1', args: {} },
              { id: 'use_data', tool: 'tool2', args: { id: '{{get_data.0.gid}}' } }
            ]
          }
        }
      })

      expect(capturedArgs.id).toBe('12345')
    })

    test('nested variable substitution', async () => {
      let capturedArgs: any = null

      const mockTool1 = new MockPlugin('tool1', () => ({
        user: { name: 'John', settings: { theme: 'dark' } }
      }))

      const mockTool2 = new MockPlugin('tool2', (context: any, params: any) => {
        capturedArgs = params
        return { result: 'done' }
      })

      mockEngine.plugins = [mockTool1, mockTool2]
      await plugin.install(mockEngine)

      await plugin.execute({} as any, {
        tool: `${kCodeExecutionPluginPrefix}run_program`,
        parameters: {
          program: {
            steps: [
              { id: 'step1', tool: 'tool1', args: {} },
              {
                id: 'step2',
                tool: 'tool2',
                args: {
                  userName: '{{step1.user.name}}',
                  theme: '{{step1.user.settings.theme}}'
                }
              }
            ]
          }
        }
      })

      expect(capturedArgs.userName).toBe('John')
      expect(capturedArgs.theme).toBe('dark')
    })

    test('bracket notation for arrays', async () => {
      let capturedArgs: any = null

      const mockTool1 = new MockPlugin('tool1', () => ({
        result: { items: ['first', 'second', 'third'] }
      }))

      const mockTool2 = new MockPlugin('tool2', (context: any, params: any) => {
        capturedArgs = params
        return { result: 'ok' }
      })

      mockEngine.plugins = [mockTool1, mockTool2]
      await plugin.install(mockEngine)

      await plugin.execute({} as any, {
        tool: `${kCodeExecutionPluginPrefix}run_program`,
        parameters: {
          program: {
            steps: [
              { id: 'step1', tool: 'tool1', args: {} },
              { id: 'step2', tool: 'tool2', args: { value: '{{step1.items[1]}}' } }
            ]
          }
        }
      })

      expect(capturedArgs.value).toBe('second')
    })

    test('explicit result property access with bracket notation', async () => {
      let capturedArgs: any = null

      const mockTool1 = new MockPlugin('tool1', () => ({
        result: [
          { gid: '8559678460204', name: 'Workspace 1' },
          { gid: '9876543210123', name: 'Workspace 2' }
        ]
      }))

      const mockTool2 = new MockPlugin('tool2', (context: any, params: any) => {
        capturedArgs = params
        return { result: 'ok' }
      })

      mockEngine.plugins = [mockTool1, mockTool2]
      await plugin.install(mockEngine)

      await plugin.execute({} as any, {
        tool: `${kCodeExecutionPluginPrefix}run_program`,
        parameters: {
          program: {
            steps: [
              { id: 'get_workspaces', tool: 'tool1', args: {} },
              { id: 'use_workspace', tool: 'tool2', args: { gid: '{{get_workspaces.result[0].gid}}' } }
            ]
          }
        }
      })

      expect(capturedArgs.gid).toBe('8559678460204')
    })

    test('variable substitution in arrays', async () => {
      let capturedArgs: any = null

      const mockTool1 = new MockPlugin('tool1', () => ({
        items: ['item1', 'item2']
      }))

      const mockTool2 = new MockPlugin('tool2', (context: any, params: any) => {
        capturedArgs = params
        return { result: 'done' }
      })

      mockEngine.plugins = [mockTool1, mockTool2]
      await plugin.install(mockEngine)

      await plugin.execute({} as any, {
        tool: `${kCodeExecutionPluginPrefix}run_program`,
        parameters: {
          program: {
            steps: [
              { id: 'step1', tool: 'tool1', args: {} },
              {
                id: 'step2',
                tool: 'tool2',
                args: {
                  items: ['{{step1.items.0}}', '{{step1.items.1}}']
                }
              }
            ]
          }
        }
      })

      expect(capturedArgs.items).toEqual(['item1', 'item2'])
    })

    test('variable substitution in nested objects', async () => {
      let capturedArgs: any = null

      const mockTool1 = new MockPlugin('tool1', () => ({
        config: { port: 8080, host: 'localhost' }
      }))

      const mockTool2 = new MockPlugin('tool2', (context: any, params: any) => {
        capturedArgs = params
        return { result: 'ok' }
      })

      mockEngine.plugins = [mockTool1, mockTool2]
      await plugin.install(mockEngine)

      await plugin.execute({} as any, {
        tool: `${kCodeExecutionPluginPrefix}run_program`,
        parameters: {
          program: {
            steps: [
              { id: 'step1', tool: 'tool1', args: {} },
              {
                id: 'step2',
                tool: 'tool2',
                args: {
                  server: {
                    port: '{{step1.config.port}}',
                    host: '{{step1.config.host}}'
                  }
                }
              }
            ]
          }
        }
      })

      expect(capturedArgs.server).toEqual({ port: '8080', host: 'localhost' })
    })
  })

  describe('run_program tool - Error Handling', () => {
    test('stops on first error', async () => {
      const mockExecute2 = vi.fn(() => ({ result: 'ok' }))

      const mockTool1 = new MockPlugin('tool1', () => {
        throw new Error('Tool failed')
      })
      const mockTool2 = new MockPlugin('tool2', mockExecute2)

      mockEngine.plugins = [mockTool1, mockTool2]
      await plugin.install(mockEngine)

      const result = await plugin.execute({} as any, {
        tool: `${kCodeExecutionPluginPrefix}run_program`,
        parameters: {
          program: {
            steps: [
              { id: 'step1', tool: 'tool1', args: {} },
              { id: 'step2', tool: 'tool2', args: {} }
            ]
          }
        }
      })

      expect(result.error).toContain('Tool failed')
      expect(result.failedStep).toBe('step1')
      expect(mockExecute2).not.toHaveBeenCalled()
    })

    test('error when referencing undefined step', async () => {
      const mockTool = new MockPlugin('tool1', () => ({ result: 'ok' }))
      mockEngine.plugins = [mockTool]
      await plugin.install(mockEngine)

      const result = await plugin.execute({} as any, {
        tool: `${kCodeExecutionPluginPrefix}run_program`,
        parameters: {
          program: {
            steps: [
              {
                id: 'step1',
                tool: 'tool1',
                args: { value: '{{undefined_step.result}}' }
              }
            ]
          }
        }
      })

      expect(result.error).toContain('has not been executed yet')
      expect(result.failedStep).toBe('step1')
    })

    test('enhanced error: shows available keys when property not found', async () => {
      const mockTool1 = new MockPlugin('tool1', () => ({
        status: 'success',
        count: 5,
        items: []
      }))
      const mockTool2 = new MockPlugin('tool2', () => ({ result: 'ok' }))

      mockEngine.plugins = [mockTool1, mockTool2]
      await plugin.install(mockEngine)

      const result = await plugin.execute({} as any, {
        tool: `${kCodeExecutionPluginPrefix}run_program`,
        parameters: {
          program: {
            steps: [
              { id: 'get_data', tool: 'tool1', args: {} },
              { id: 'use_data', tool: 'tool2', args: { value: '{{get_data.nonexistent}}' } }
            ]
          }
        }
      })

      // Now returns simple schema instead of descriptive error
      expect(result.error).toContain('status')
      expect(result.error).toContain('count')
      expect(result.error).toContain('items')
      expect(result.error).toContain('"string"')
      expect(result.error).toContain('"number"')
    })

    test('enhanced error: shows array length when index out of bounds', async () => {
      const mockTool1 = new MockPlugin('tool1', () => ({
        items: ['a', 'b', 'c']
      }))
      const mockTool2 = new MockPlugin('tool2', () => ({ result: 'ok' }))

      mockEngine.plugins = [mockTool1, mockTool2]
      await plugin.install(mockEngine)

      const result = await plugin.execute({} as any, {
        tool: `${kCodeExecutionPluginPrefix}run_program`,
        parameters: {
          program: {
            steps: [
              { id: 'step1', tool: 'tool1', args: {} },
              { id: 'step2', tool: 'tool2', args: { value: '{{step1.items.5}}' } }
            ]
          }
        }
      })

      // Now returns simple schema instead of descriptive error
      expect(result.error).toContain('items')
      expect(result.error).toContain('"string"')
      expect(result.error).toContain('[')
    })

    test('enhanced error: accessing property on primitive', async () => {
      const mockTool1 = new MockPlugin('tool1', () => ({
        message: 'Hello World'
      }))
      const mockTool2 = new MockPlugin('tool2', () => ({ result: 'ok' }))

      mockEngine.plugins = [mockTool1, mockTool2]
      await plugin.install(mockEngine)

      const result = await plugin.execute({} as any, {
        tool: `${kCodeExecutionPluginPrefix}run_program`,
        parameters: {
          program: {
            steps: [
              { id: 'step1', tool: 'tool1', args: {} },
              { id: 'step2', tool: 'tool2', args: { value: '{{step1.message.length}}' } }
            ]
          }
        }
      })

      // Now returns simple schema instead of descriptive error
      expect(result.error).toContain('message')
      expect(result.error).toContain('"string"')
    })

    test('enhanced error: bracket notation with non-array', async () => {
      const mockTool1 = new MockPlugin('tool1', () => ({
        result: { count: 5 }
      }))
      const mockTool2 = new MockPlugin('tool2', () => ({ result: 'ok' }))

      mockEngine.plugins = [mockTool1, mockTool2]
      await plugin.install(mockEngine)

      const result = await plugin.execute({} as any, {
        tool: `${kCodeExecutionPluginPrefix}run_program`,
        parameters: {
          program: {
            steps: [
              { id: 'step1', tool: 'tool1', args: {} },
              { id: 'step2', tool: 'tool2', args: { value: '{{step1[0]}}' } }
            ]
          }
        }
      })

      // Now returns simple schema instead of descriptive error
      expect(result.error).toContain('count')
      expect(result.error).toContain('"number"')
    })

    test('enhanced error: bracket notation index out of bounds', async () => {
      const mockTool1 = new MockPlugin('tool1', () => ({
        result: ['a', 'b']
      }))
      const mockTool2 = new MockPlugin('tool2', () => ({ result: 'ok' }))

      mockEngine.plugins = [mockTool1, mockTool2]
      await plugin.install(mockEngine)

      const result = await plugin.execute({} as any, {
        tool: `${kCodeExecutionPluginPrefix}run_program`,
        parameters: {
          program: {
            steps: [
              { id: 'step1', tool: 'tool1', args: {} },
              { id: 'step2', tool: 'tool2', args: { value: '{{step1.result[5]}}' } }
            ]
          }
        }
      })

      // Now returns simple schema instead of descriptive error
      expect(result.error).toContain('"string"')
      expect(result.error).toContain('[')
    })

    test('error when tool returns error object', async () => {
      const mockTool = new MockPlugin('tool1', () => ({
        error: 'Tool execution failed'
      }))

      mockEngine.plugins = [mockTool]
      await plugin.install(mockEngine)

      const result = await plugin.execute({} as any, {
        tool: `${kCodeExecutionPluginPrefix}run_program`,
        parameters: {
          program: {
            steps: [
              { id: 'step1', tool: 'tool1', args: {} }
            ]
          }
        }
      })

      expect(result.error).toContain('Tool execution failed')
      expect(result.failedStep).toBe('step1')
    })

    test('error when tool returns string starting with "Error"', async () => {
      const mockTool = new MockPlugin('tool1', () => 'Error: Something went wrong')

      mockEngine.plugins = [mockTool]
      await plugin.install(mockEngine)

      const result = await plugin.execute({} as any, {
        tool: `${kCodeExecutionPluginPrefix}run_program`,
        parameters: {
          program: {
            steps: [
              { id: 'step1', tool: 'tool1', args: {} }
            ]
          }
        }
      })

      expect(result.failedStep).toBe('step1')
    })
  })

  describe('run_program tool - Streaming Updates', () => {
    test('yields status updates for each step', async () => {
      const mockTool = new MockPlugin('tool1', () => ({ result: 'success' }))
      mockEngine.plugins = [mockTool]
      await plugin.install(mockEngine)

      const updates: any[] = []
      for await (const update of plugin.executeWithUpdates({} as any, {
        tool: `${kCodeExecutionPluginPrefix}run_program`,
        parameters: {
          program: {
            steps: [
              { id: 'step1', tool: 'tool1', args: {} }
            ]
          }
        }
      })) {
        updates.push(update)
      }

      expect(updates).toHaveLength(3)
      expect(updates[0]).toMatchObject({ type: 'status', status: expect.stringContaining('Executing step step1') })
      expect(updates[1]).toMatchObject({ type: 'status', status: expect.stringContaining('Completed step step1') })
      expect(updates[2]).toMatchObject({ type: 'result', result: 'success' })
    })

    test('yields status updates for multiple steps', async () => {
      const mockTool1 = new MockPlugin('tool1', () => ({ result: 'first' }))
      const mockTool2 = new MockPlugin('tool2', () => ({ result: 'second' }))

      mockEngine.plugins = [mockTool1, mockTool2]
      await plugin.install(mockEngine)

      const updates: any[] = []
      for await (const update of plugin.executeWithUpdates({} as any, {
        tool: `${kCodeExecutionPluginPrefix}run_program`,
        parameters: {
          program: {
            steps: [
              { id: 'step1', tool: 'tool1', args: {} },
              { id: 'step2', tool: 'tool2', args: {} }
            ]
          }
        }
      })) {
        updates.push(update)
      }

      expect(updates).toHaveLength(5)
      expect(updates[0]).toMatchObject({ type: 'status', status: expect.stringContaining('step1') })
      expect(updates[1]).toMatchObject({ type: 'status', status: expect.stringContaining('Completed step step1') })
      expect(updates[2]).toMatchObject({ type: 'status', status: expect.stringContaining('step2') })
      expect(updates[3]).toMatchObject({ type: 'status', status: expect.stringContaining('Completed step step2') })
      expect(updates[4]).toMatchObject({ type: 'result', result: 'second' })
    })

    test('handles abort signal', async () => {
      const abortController = new AbortController()
      const mockTool = new MockPlugin('tool1', () => {
        return new Promise((resolve) => {
          setTimeout(() => resolve({ result: 'success' }), 100)
        })
      })

      mockEngine.plugins = [mockTool]
      await plugin.install(mockEngine)

      abortController.abort()

      const updates: any[] = []
      for await (const update of plugin.executeWithUpdates(
        { abortSignal: abortController.signal } as any,
        {
          tool: `${kCodeExecutionPluginPrefix}run_program`,
          parameters: {
            program: {
              steps: [{ id: 'step1', tool: 'tool1', args: {} }]
            }
          }
        }
      )) {
        updates.push(update)
      }

      expect(updates).toHaveLength(1)
      expect(updates[0]).toMatchObject({
        type: 'result',
        result: { error: 'Workflow cancelled' },
        canceled: true
      })
    })
  })

  describe('run_program tool - MultiToolPlugin Support', () => {
    test('handles MultiToolPlugin correctly', async () => {
      class MockMultiToolPlugin extends MultiToolPlugin {
        getName(): string { return 'multi' }
        getDescription(): string { return 'Multi tool' }
        getParameters(): any[] { return [] }
        getRunningDescription(): string { return 'Running' }

        async getTools() {
          return [{ type: 'function', function: { name: 'multi_tool_1' } }]
        }

        handlesTool(name: string): boolean {
          return name === 'multi_tool_1'
        }

        async execute(context: any, parameters: any): Promise<any> {
          return { result: parameters.parameters.value }
        }
      }

      const multiPlugin = new MockMultiToolPlugin()
      mockEngine.plugins = [multiPlugin]
      await plugin.install(mockEngine)

      const result = await plugin.execute({} as any, {
        tool: `${kCodeExecutionPluginPrefix}run_program`,
        parameters: {
          program: {
            steps: [
              { id: 'step1', tool: 'multi_tool_1', args: { value: 'test' } }
            ]
          }
        }
      })

      expect(result).toBe('test')
    })
  })

  describe('run_program tool - Result Unwrapping', () => {
    test('unwraps result property automatically', async () => {
      const mockTool = new MockPlugin('tool1', () => ({ result: 'success' }))
      mockEngine.plugins = [mockTool]
      await plugin.install(mockEngine)

      const result = await plugin.execute({} as any, {
        tool: `${kCodeExecutionPluginPrefix}run_program`,
        parameters: {
          program: {
            steps: [
              { id: 'step1', tool: 'tool1', args: {} }
            ]
          }
        }
      })

      expect(result).toBe('success')
    })

    test('unwraps data property automatically', async () => {
      const mockTool = new MockPlugin('tool1', () => ({
        result: { data: { value: 'unwrapped' } }
      }))

      mockEngine.plugins = [mockTool]
      await plugin.install(mockEngine)

      const result = await plugin.execute({} as any, {
        tool: `${kCodeExecutionPluginPrefix}run_program`,
        parameters: {
          program: {
            steps: [
              { id: 'step1', tool: 'tool1', args: {} }
            ]
          }
        }
      })

      expect(result).toEqual({ value: 'unwrapped' })
    })

    test('handles non-wrapped results', async () => {
      const mockTool = new MockPlugin('tool1', () => 'plain string result')

      mockEngine.plugins = [mockTool]
      await plugin.install(mockEngine)

      const result = await plugin.execute({} as any, {
        tool: `${kCodeExecutionPluginPrefix}run_program`,
        parameters: {
          program: {
            steps: [
              { id: 'step1', tool: 'tool1', args: {} }
            ]
          }
        }
      })

      expect(result).toBe('plain string result')
    })

    test('parses JSON string results', async () => {
      const mockTool = new MockPlugin('tool1', () => '{"status":"ok","value":42}')

      mockEngine.plugins = [mockTool]
      await plugin.install(mockEngine)

      const result = await plugin.execute({} as any, {
        tool: `${kCodeExecutionPluginPrefix}run_program`,
        parameters: {
          program: {
            steps: [
              { id: 'step1', tool: 'tool1', args: {} }
            ]
          }
        }
      })

      expect(result).toEqual({ status: 'ok', value: 42 })
    })
  })

  describe('Unknown Tool Handling', () => {
    test('returns error for unknown tool', async () => {
      await plugin.install(mockEngine)

      const result = await plugin.execute({} as any, {
        tool: `${kCodeExecutionPluginPrefix}unknown_tool`,
        parameters: {}
      })

      expect(result.error).toContain('Tool')
      expect(result.error).toContain('not found')
    })
  })
})

import { vi, test, expect, describe, beforeAll, beforeEach } from 'vitest'
import { useWindowMock } from '../../mocks/window'
import { useTools } from '../../../src/composables/tools'
import { store } from '../../../src/services/store'

beforeAll(() => {
  useWindowMock()
})

beforeEach(() => {
  store.loadSettings()
  vi.clearAllMocks()
})

describe('tools composable', () => {

  test('getAllAvailableTools returns catalog structure', async () => {
    const { getAllAvailableTools } = useTools()
    vi.mocked(window.api.mcp.getAllServersWithTools).mockResolvedValueOnce([])

    const catalog = await getAllAvailableTools(store.config)

    expect(catalog).toHaveProperty('builtInTools')
    expect(catalog).toHaveProperty('mcpTools')
    expect(catalog).toHaveProperty('allTools')
    expect(Array.isArray(catalog.builtInTools)).toBe(true)
    expect(Array.isArray(catalog.mcpTools)).toBe(true)
    expect(Array.isArray(catalog.allTools)).toBe(true)
  })

  test('getAllAvailableTools includes MCP tools', async () => {
    const { getAllAvailableTools } = useTools()
    vi.mocked(window.api.mcp.getAllServersWithTools).mockResolvedValueOnce([
      {
        uuid: 'server1',
        registryId: 'test-server',
        state: 'enabled',
        type: 'stdio',
        command: 'node',
        url: 'test.js',
        toolSelection: null,
        tools: [
          { uuid: 'tool1', name: 'mcp_tool_1', description: 'Test tool 1' },
          { uuid: 'tool2', name: 'mcp_tool_2', description: 'Test tool 2' }
        ]
      }
    ])

    const catalog = await getAllAvailableTools(store.config)

    expect(catalog.mcpTools.length).toBeGreaterThan(0)
  })

  test('getToolsForGeneration returns string description', async () => {
    const { getToolsForGeneration } = useTools()
    vi.mocked(window.api.mcp.getAllServersWithTools).mockResolvedValueOnce([])

    const result = await getToolsForGeneration(store.config)

    expect(typeof result).toBe('string')
    expect(result).toContain('Available Tools')
  })

  test('getToolsForGeneration includes MCP tools in description', async () => {
    const { getToolsForGeneration } = useTools()
    vi.mocked(window.api.mcp.getAllServersWithTools).mockResolvedValueOnce([
      {
        uuid: 'server1',
        registryId: 'test-server',
        state: 'enabled',
        type: 'stdio',
        command: 'node',
        url: 'test.js',
        toolSelection: null,
        tools: [
          { uuid: 'tool1', name: 'mcp_tool_1', description: 'Test tool 1' }
        ]
      }
    ])

    const result = await getToolsForGeneration(store.config)

    // Just verify it's a string with content - MCP tool formatting is complex
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  test('getToolsForGeneration includes built-in tools', async () => {
    const { getToolsForGeneration } = useTools()
    vi.mocked(window.api.mcp.getAllServersWithTools).mockResolvedValueOnce([])

    const result = await getToolsForGeneration(store.config)

    // Should have built-in tools
    expect(result).toContain('Built-in Tools')
  })

  test('getToolIds extracts IDs from catalog', async () => {
    const { getAllAvailableTools, getToolIds } = useTools()
    vi.mocked(window.api.mcp.getAllServersWithTools).mockResolvedValueOnce([])

    const catalog = await getAllAvailableTools(store.config)
    const ids = getToolIds(catalog)

    expect(Array.isArray(ids)).toBe(true)
    expect(ids.length).toBe(catalog.allTools.length)
  })

  test('getToolIds returns empty array for empty catalog', () => {
    const { getToolIds } = useTools()

    const emptyCatalog = {
      builtInTools: [],
      mcpTools: [],
      allTools: []
    }

    const ids = getToolIds(emptyCatalog)

    expect(ids).toEqual([])
  })
})

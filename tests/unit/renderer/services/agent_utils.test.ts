import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import Agent from '@models/agent'
import { useWindowMock } from '@tests/mocks/window'
import { createI18nMock } from '@tests/mocks'
import { remapAgentMcpTools } from '@services/agent_utils'
import { McpServerWithTools, McpToolUnique } from '@/types/mcp'

vi.mock('@services/i18n', async () => {
  return createI18nMock()
})


beforeAll(() => {
 useWindowMock()
})

beforeEach(() => {
  vi.clearAllMocks()
})

describe('remapAgentMcpTools', () => {

  test('should remap tool when exactly one match is found', async () => {
    // Setup
    const agent = new Agent()
    agent.steps = [{
      prompt: 'Test',
      tools: ['search_files___abcd'], // Imported tool with old suffix
      agents: [],
    }]

    // Mock MCP tools available locally
    const mockServersWithTools: Array<McpServerWithTools> = [{
      tools: [
        {
          name: 'search_files',
          uuid: 'search_files___efgh', // Local tool with different suffix
          description: 'Search for files',
        }
      ]
    }] as McpServerWithTools[]

    // Mock window.api.mcp methods
    window.api.mcp.getAllServersWithTools = vi.fn().mockResolvedValue(mockServersWithTools)

    // Execute
    const { agent: remappedAgent, warnings } = await remapAgentMcpTools(agent)

    // Verify
    expect(remappedAgent.steps[0].tools).toEqual(['search_files___efgh'])
    expect(warnings).toHaveLength(0)
  })

  test('should add warning when tool is not found', async () => {
    // Setup
    const agent = new Agent()
    agent.steps = [{
      prompt: 'Test',
      tools: ['missing_tool___abcd'],
      agents: [],
    }]

    // Mock MCP tools (empty)
    const mockServersWithTools: Array<McpServerWithTools> = [{
      tools: [] as McpToolUnique[],
    }] as McpServerWithTools[]

    // Mock window.api.mcp methods

    window.api.mcp.getAllServersWithTools = vi.fn().mockResolvedValue(mockServersWithTools)

    // Execute
    const { agent: remappedAgent, warnings } = await remapAgentMcpTools(agent)

    // Verify
    expect(remappedAgent.steps[0].tools).toEqual([])
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toBe('agent.forge.import.toolNotFound_default_step=1&tool=missing_tool')
  })

  test('should add warning when multiple matches are found', async () => {
    // Setup
    const agent = new Agent()
    agent.steps = [{
      prompt: 'Test',
      tools: ['search_files___abcd'],
      agents: [],
    }]

    // Mock MCP tools with duplicate names (shouldn't happen but we handle it)
    const mockServersWithTools: Array<McpServerWithTools> = [{
      tools: [
        {
          name: 'search_files',
          uuid: 'search_files___efgh',
          description: 'Search for files server 1',
        },
        {
          name: 'search_files',
          uuid: 'search_files___ijkl',
          description: 'Search for files server 2',
        }
      ]
    }] as McpServerWithTools[]

    window.api.mcp.getAllServersWithTools = vi.fn().mockResolvedValue(mockServersWithTools)

    // Execute
    const { agent: remappedAgent, warnings } = await remapAgentMcpTools(agent)

    // Verify
    expect(remappedAgent.steps[0].tools).toEqual([])
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toBe('agent.forge.import.toolNotFound_default_step=1&tool=search_files')
  })

  test('should handle agent with no tools', async () => {
    // Setup
    const agent = new Agent()
    agent.steps = [{
      prompt: 'Test',
      tools: null,
      agents: [],
    }]

    window.api.mcp.getAllServersWithTools = vi.fn().mockResolvedValue([])

    // Execute
    const { agent: remappedAgent, warnings } = await remapAgentMcpTools(agent)

    // Verify
    expect(remappedAgent.steps[0].tools).toBeNull()
    expect(warnings).toHaveLength(0)
  })

  test('should handle agent with empty tools array', async () => {
    // Setup
    const agent = new Agent()
    agent.steps = [{
      prompt: 'Test',
      tools: [],
      agents: [],
    }]

    window.api.mcp.getAllServersWithTools = vi.fn().mockResolvedValue([])

    // Execute
    const { agent: remappedAgent, warnings } = await remapAgentMcpTools(agent)

    // Verify
    expect(remappedAgent.steps[0].tools).toEqual([])
    expect(warnings).toHaveLength(0)
  })

  test('should handle mixed results across multiple steps', async () => {
    // Setup
    const agent = new Agent()
    agent.steps = [
      {
        prompt: 'Step 1',
        tools: ['found_tool___abcd'],
        agents: [],
      },
      {
        prompt: 'Step 2',
        tools: ['missing_tool___efgh'],
        agents: [],
      },
      {
        prompt: 'Step 3',
        tools: ['another_found___ijkl', 'another_missing___mnop'],
        agents: [],
      }
    ]

    // Mock MCP tools
    const mockServersWithTools: Array<McpServerWithTools> = [{
      tools: [
        {
          name: 'found_tool',
          uuid: 'found_tool___xyz1',
          description: 'A tool that will be found',
        },
        {
          name: 'another_found',
          uuid: 'another_found___xyz2',
          description: 'Another tool that will be found',
        }
      ]
    }] as McpServerWithTools[]

    window.api.mcp.getAllServersWithTools = vi.fn().mockResolvedValue(mockServersWithTools)

    // Execute
    const { agent: remappedAgent, warnings } = await remapAgentMcpTools(agent)

    // Verify
    expect(remappedAgent.steps[0].tools).toEqual(['found_tool___xyz1'])
    expect(remappedAgent.steps[1].tools).toEqual([])
    expect(remappedAgent.steps[2].tools).toEqual(['another_found___xyz2'])
    expect(warnings).toHaveLength(2)
    expect(warnings[0]).toBe('agent.forge.import.toolNotFound_default_step=2&tool=missing_tool')
    expect(warnings[1]).toBe('agent.forge.import.toolNotFound_default_step=3&tool=another_missing')
  })

  test('should handle tools from multiple servers', async () => {
    // Setup
    const agent = new Agent()
    agent.steps = [{
      prompt: 'Test',
      tools: ['tool_server1___abcd', 'tool_server2___efgh'],
      agents: [],
    }]

    // Mock MCP tools from different servers
    const mockServersWithTools: Array<McpServerWithTools> = [
      {
        tools: [{
          name: 'tool_server1',
          uuid: 'tool_server1___xyz1',
          description: 'Tool from server 1',
        }]
      },
      {
        tools: [{
          name: 'tool_server2',
          uuid: 'tool_server2___xyz2',
          description: 'Tool from server 2',
        }]
      }
    ] as McpServerWithTools[]

    window.api.mcp.getAllServersWithTools = vi.fn().mockResolvedValue(mockServersWithTools)

    // Execute
    const { agent: remappedAgent, warnings } = await remapAgentMcpTools(agent)

    // Verify
    expect(remappedAgent.steps[0].tools).toEqual(['tool_server1___xyz1', 'tool_server2___xyz2'])
    expect(warnings).toHaveLength(0)
  })

})

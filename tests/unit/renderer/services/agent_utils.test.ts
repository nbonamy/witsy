import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import Agent from '@models/agent'
import { useWindowMock } from '@tests/mocks/window'
import { createI18nMock } from '@tests/mocks'
import { remapAgentMcpTools } from '@services/agent_utils'
import { McpServerWithTools, McpTool } from '@/types/mcp'

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
          function: 'search_files', // Local tool with different suffix
          description: 'Search for files',
        }
      ]
    }] as McpServerWithTools[]

    // Mock window.api.mcp methods
    window.api.mcp.getAllServersWithTools = vi.fn().mockResolvedValue(mockServersWithTools)

    // Execute
    const { agent: remappedAgent, warnings } = await remapAgentMcpTools(agent)

    // Verify
    expect(remappedAgent.steps[0].tools).toEqual(['search_files'])
    expect(warnings).toHaveLength(0)
  })

  test('should handle tool not found without adding warning', async () => {
    // Setup
    const agent = new Agent()
    agent.steps = [{
      prompt: 'Test',
      tools: ['missing_tool'],
      agents: [],
    }]

    // Mock MCP tools (empty)
    const mockServersWithTools: Array<McpServerWithTools> = [{
      tools: [] as McpTool[],
    }] as McpServerWithTools[]

    // Mock window.api.mcp methods

    window.api.mcp.getAllServersWithTools = vi.fn().mockResolvedValue(mockServersWithTools)

    // Execute
    const { agent: remappedAgent, warnings } = await remapAgentMcpTools(agent)

    // Verify
    expect(remappedAgent.steps[0].tools).toEqual(['missing_tool'])
    expect(warnings).toHaveLength(0)
  })

  test('should add warning when multiple matches are found', async () => {
    // Setup
    const agent = new Agent()
    agent.steps = [{
      prompt: 'Test',
      tools: ['search_files'],
      agents: [],
    }]

    // Mock MCP tools with duplicate names (shouldn't happen but we handle it)
    const mockServersWithTools: Array<McpServerWithTools> = [{
      tools: [
        {
          name: 'search_files',
          function: 'search_files',
          description: 'Search for files server 1',
        },
        {
          name: 'search_files',
          function: 'search_files',
          description: 'Search for files server 2',
        }
      ]
    }] as McpServerWithTools[]

    window.api.mcp.getAllServersWithTools = vi.fn().mockResolvedValue(mockServersWithTools)

    // Execute
    const { agent: remappedAgent, warnings } = await remapAgentMcpTools(agent)

    // Verify
    expect(remappedAgent.steps[0].tools).toEqual(['search_files'])
    expect(warnings).toHaveLength(0)
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
          function: 'found_tool',
          description: 'A tool that will be found',
        },
        {
          name: 'another_found',
          function: 'another_found',
          description: 'Another tool that will be found',
        }
      ]
    }] as McpServerWithTools[]

    window.api.mcp.getAllServersWithTools = vi.fn().mockResolvedValue(mockServersWithTools)

    // Execute
    const { agent: remappedAgent, warnings } = await remapAgentMcpTools(agent)

    // Verify
    expect(remappedAgent.steps[0].tools).toEqual(['found_tool'])
    expect(remappedAgent.steps[1].tools).toEqual([])
    expect(remappedAgent.steps[2].tools).toEqual(['another_found'])
    expect(warnings).toHaveLength(2)
    expect(warnings[0]).toBe('agent.forge.import.toolNotFound_default_step=2&tool=missing_tool')
    expect(warnings[1]).toBe('agent.forge.import.toolNotFound_default_step=3&tool=another_missing')
  })

  test('should handle tools from multiple servers', async () => {
    // Setup
    const agent = new Agent()
    agent.steps = [{
      prompt: 'Test',
      tools: ['tool_server1', 'tool_server2'],
      agents: [],
    }]

    // Mock MCP tools from different servers
    const mockServersWithTools: Array<McpServerWithTools> = [
      {
        tools: [{
          name: 'tool_server1',
          function: 'tool_server1',
          description: 'Tool from server 1',
        }]
      },
      {
        tools: [{
          name: 'tool_server2',
          function: 'tool_server2',
          description: 'Tool from server 2',
        }]
      }
    ] as McpServerWithTools[]

    window.api.mcp.getAllServersWithTools = vi.fn().mockResolvedValue(mockServersWithTools)

    // Execute
    const { agent: remappedAgent, warnings } = await remapAgentMcpTools(agent)

    // Verify
    expect(remappedAgent.steps[0].tools).toEqual(['tool_server1', 'tool_server2'])
    expect(warnings).toHaveLength(0)
  })

})

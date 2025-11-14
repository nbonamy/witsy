import { vi, test, expect, describe, beforeAll } from 'vitest'
import type { McpToolUnique } from '../../../../src/types/mcp'
import * as toolSelection from '../../../../src/renderer/utils/tool_selection'
import { useWindowMock } from '../../../mocks/window'

// Mock dependencies
vi.mock('../../../../src/renderer/services/plugins/plugins', () => {
  return {
    availablePlugins: {
      'search': class MockSearchPlugin {
        constructor() {}
        isEnabled() { return true }
        getName() { return 'web_search' }
      },
      'filesystem': class MockFilesystemPlugin {
        constructor() {}
        isEnabled() { return true }
        getName() { return 'Filesystem' }
        getToolNamePrefix() { return 'filesystem_' }
        // Multi-tool plugin with prefix
      },
      'python': class MockPythonPlugin {
        constructor() {}
        isEnabled() { return false } // disabled plugin
        getName() { return 'python' }
      },
      'mcp': class MockMcpPlugin {
        constructor() {}
        isEnabled() { return true }
        getName() { return 'mcp' }
      }
    },
    pluginTools: vi.fn(async (config, pluginName) => {
      if (pluginName === 'search') return ['web_search']
      if (pluginName === 'filesystem') return ['filesystem_list', 'filesystem_read', 'filesystem_write']
      if (pluginName === 'mcp') return ['mcp']
      else return []
    }),
    pluginToolName: vi.fn((config, pluginName) => {
      if (pluginName === 'search') return { name: 'web_search', multi: false }
      if (pluginName === 'filesystem') return { name: 'filesystem_', multi: true }
      if (pluginName === 'mcp') return { name: 'mcp', multi: false }
      else return { name: '', multi: false }
    }),
  }
})

vi.mock('../../../../src/renderer/services/store', () => ({
  store: {
    config: {
      plugins: {
        search: {},
        filesystem: {},
        python: {},
        mcp: {}
      }
    }
  }
}))

describe('tool_selection', () => {

  beforeAll(() => {
    useWindowMock()
  })

  describe('allPluginsTools', () => {
    test('should return enabled plugin tools excluding mcp by default', async () => {
      const result = await toolSelection.allPluginsTools()
      expect(result).toEqual(['web_search', 'filesystem_list', 'filesystem_read', 'filesystem_write'])
    })

    test('should include mcp plugin when includeMcp is true', async () => {
      const result = await toolSelection.allPluginsTools(true)
      expect(result).toEqual(['web_search', 'filesystem_list', 'filesystem_read', 'filesystem_write', 'mcp'])
    })
  })

  describe('initToolSelectionWithAllTools', () => {
    test('should return all tools including mcp server tools', async () => {
      const result = await toolSelection.initToolSelectionWithAllTools()
      expect(result).toEqual(['web_search', 'filesystem_list', 'filesystem_read', 'filesystem_write', 'tool1_1', 'tool2_1', 'tool3_2', 'tool4_2'])
    })
  })

  describe('validateToolSelection', () => {
    test('should return null when all tools are selected', async () => {
      const allTools = ['web_search', 'filesystem_list', 'filesystem_read', 'filesystem_write', 'tool1_1', 'tool2_1', 'tool3_2', 'tool4_2']
      const result = await toolSelection.validateToolSelection(allTools)
      expect(result).toBeNull()
    })

    test('should return the selection when partial tools are selected', async () => {
      const partialTools = ['web_search', 'filesystem_list']
      const result = await toolSelection.validateToolSelection(partialTools)
      expect(result).toEqual(partialTools)
    })

    test('should return null when selection is null', async () => {
      const result = await toolSelection.validateToolSelection(null)
      expect(result).toBeNull()
    })

    test('should return empty array when empty selection', async () => {
      const result = await toolSelection.validateToolSelection([])
      expect(result).toEqual([])
    })
  })

  describe('pluginsStatus', () => {
    test('should return "all" when toolSelection is null', async () => {
      const result = await toolSelection.pluginsStatus(null)
      expect(result).toBe('all')
    })

    test('should return "none" when toolSelection is empty', async () => {
      const result = await toolSelection.pluginsStatus([])
      expect(result).toBe('none')
    })

    test('should return "all" when all plugin tools are selected', async () => {
      const allPlugins = ['web_search', 'filesystem_list', 'filesystem_read', 'filesystem_write']
      const result = await toolSelection.pluginsStatus(allPlugins)
      expect(result).toBe('all')
    })

    test('should return "some" when some plugin tools are selected', async () => {
      const somePlugins = ['web_search']
      const result = await toolSelection.pluginsStatus(somePlugins)
      expect(result).toBe('some')
    })

    test('should return "none" when no plugin tools are selected', async () => {
      const noPlugins = ['tool1_1', 'tool2_1'] // MCP tools only
      const result = await toolSelection.pluginsStatus(noPlugins)
      expect(result).toBe('none')
    })
  })

  describe('pluginStatus', () => {
    test('should return "all" when toolSelection is null', () => {
      const result = toolSelection.pluginStatus(null, 'web_search')
      expect(result).toBe('all')
    })

    test('should return "none" when toolSelection is empty', () => {
      const result = toolSelection.pluginStatus([], 'web_search')
      expect(result).toBe('none')
    })

    test('should return "all" when plugin is selected', () => {
      const result = toolSelection.pluginStatus(['web_search', 'filesystem_list'], 'search')
      expect(result).toBe('all')
    })

    test('should return "none" when plugin is not selected', () => {
      const result = toolSelection.pluginStatus(['filesystem_list'], 'search')
      expect(result).toBe('none')
    })

    describe('multi-tool plugin', () => {
      test('should return "all" when any tool with prefix is selected', () => {
        const result = toolSelection.pluginStatus(['web_search', 'filesystem_list'], 'filesystem')
        expect(result).toBe('all')
      })

      test('should return "all" when all tools with prefix are selected', () => {
        const result = toolSelection.pluginStatus(['filesystem_list', 'filesystem_read', 'filesystem_write'], 'filesystem')
        expect(result).toBe('all')
      })

      test('should return "all" when some tools with prefix are selected', () => {
        const result = toolSelection.pluginStatus(['web_search', 'filesystem_read'], 'filesystem')
        expect(result).toBe('all')
      })

      test('should return "none" when no tools with prefix are selected', () => {
        const result = toolSelection.pluginStatus(['web_search', 'tool1_1'], 'filesystem')
        expect(result).toBe('none')
      })
    })
  })

  describe('serverToolsStatus', () => {
    test('should return "all" when toolSelection is null', async () => {
      const servers = await window.api.mcp.getAllServersWithTools()
      const result = toolSelection.serverToolsStatus(servers, null, servers[0])
      expect(result).toBe('all')
    })

    test('should return "none" when toolSelection is empty', async () => {
      const servers = await window.api.mcp.getAllServersWithTools()
      const result = toolSelection.serverToolsStatus(servers, [], servers[0])
      expect(result).toBe('none')
    })

    test('should return "all" when all server tools are selected', async () => {
      const servers = await window.api.mcp.getAllServersWithTools()
      const serverTools = ['tool1_1', 'tool2_1']
      const result = toolSelection.serverToolsStatus(servers, serverTools, servers[0])
      expect(result).toBe('all')
    })

    test('should return "some" when some server tools are selected', async () => {
      const servers = await window.api.mcp.getAllServersWithTools()
      const someServerTools = ['tool1_1']
      const result = toolSelection.serverToolsStatus(servers, someServerTools, servers[0])
      expect(result).toBe('some')
    })

    test('should return "none" when no server tools are selected', async () => {
      const servers = await window.api.mcp.getAllServersWithTools()
      const noServerTools = ['web_search', 'filesystem_list'] // Plugin tools only
      const result = toolSelection.serverToolsStatus(servers, noServerTools, servers[0])
      expect(result).toBe('none')
    })
  })

  describe('serverToolStatus', () => {
    test('should return "all" when toolSelection is null', async () => {
      const servers = await window.api.mcp.getAllServersWithTools()
      const tool: McpToolUnique = { uuid: 'tool1_1', name: 'tool1', description: 'description1' }
      const result = toolSelection.serverToolStatus(servers, null, servers[0], tool)
      expect(result).toBe('all')
    })

    test('should return "none" when toolSelection is empty', async () => {
      const servers = await window.api.mcp.getAllServersWithTools()
      const tool: McpToolUnique = { uuid: 'tool1_1', name: 'tool1', description: 'description1' }
      const result = toolSelection.serverToolStatus(servers, [], servers[0], tool)
      expect(result).toBe('none')
    })

    test('should return "all" when tool is selected', async () => {
      const servers = await window.api.mcp.getAllServersWithTools()
      const tool: McpToolUnique = { uuid: 'tool1_1', name: 'tool1', description: 'description1' }
      const result = toolSelection.serverToolStatus(servers, ['tool1_1', 'web_search'], servers[0], tool)
      expect(result).toBe('all')
    })

    test('should return "none" when tool is not selected', async () => {
      const servers = await window.api.mcp.getAllServersWithTools()
      const tool: McpToolUnique = { uuid: 'tool1_1', name: 'tool1', description: 'description1' }
      const result = toolSelection.serverToolStatus(servers, ['tool2_1', 'web_search'], servers[0], tool)
      expect(result).toBe('none')
    })
  })

  describe('handleAllPluginsToggle', () => {
    test('should unselect all plugins when starting with null (all selected)', async () => {
      const result = await toolSelection.handleAllPluginsToggle(null)
      expect(result).toEqual(['tool1_1', 'tool2_1', 'tool3_2', 'tool4_2'])
    })

    test('should unselect all plugins when all plugins are selected', async () => {
      const allTools = ['web_search', 'filesystem_list', 'filesystem_read', 'filesystem_write', 'tool1_1', 'tool2_1']
      const result = await toolSelection.handleAllPluginsToggle(allTools)
      expect(result).toEqual(['tool1_1', 'tool2_1'])
    })

    test('should select all plugins when some plugins are selected', async () => {
      const someTools = ['web_search', 'tool1_1']
      const result = await toolSelection.handleAllPluginsToggle(someTools)
      expect(result).toEqual(['tool1_1', 'web_search', 'filesystem_list', 'filesystem_read', 'filesystem_write'])
    })

    test('should select all plugins when no plugins are selected', async () => {
      const noPlugins = ['tool1_1', 'tool2_1']
      const result = await toolSelection.handleAllPluginsToggle(noPlugins)
      expect(result).toEqual(['tool1_1', 'tool2_1', 'web_search', 'filesystem_list', 'filesystem_read', 'filesystem_write'])
    })
  })

  describe('handlePluginToggle', () => {
    test('should remove plugin when starting with null (all selected)', async () => {
      const result = await toolSelection.handlePluginToggle(null, 'search')
      expect(result).toEqual(['filesystem_list', 'filesystem_read', 'filesystem_write', 'tool1_1', 'tool2_1', 'tool3_2', 'tool4_2'])
    })

    test('should add plugin when not in selection', async () => {
      const selection = ['tool1_1']
      const result = await toolSelection.handlePluginToggle(selection, 'search')
      expect(result).toEqual(['tool1_1', 'web_search'])
    })

    test('should remove plugin when in selection', async () => {
      const selection = ['web_search', 'tool1_1']
      const result = await toolSelection.handlePluginToggle(selection, 'search')
      expect(result).toEqual(['tool1_1'])
    })

    test('should return null when all tools end up selected', async () => {
      const selection = ['filesystem_list', 'filesystem_read', 'filesystem_write', 'tool1_1', 'tool2_1', 'tool3_2', 'tool4_2']
      const result = await toolSelection.handlePluginToggle(selection, 'search')
      expect(result).toBeNull()
    })

    describe('multi-tool plugin', () => {
      test('should add all tools when toggling on from empty', async () => {
        const selection = ['web_search']
        const result = await toolSelection.handlePluginToggle(selection, 'filesystem')
        expect(result).toEqual(['web_search', 'filesystem_list', 'filesystem_read', 'filesystem_write'])
      })

      test('should remove all tools when toggling off', async () => {
        const selection = ['web_search', 'filesystem_list', 'filesystem_read', 'filesystem_write']
        const result = await toolSelection.handlePluginToggle(selection, 'filesystem')
        expect(result).toEqual(['web_search'])
      })

      test('should remove all tools even when only some are selected', async () => {
        const selection = ['web_search', 'filesystem_read']
        const result = await toolSelection.handlePluginToggle(selection, 'filesystem')
        expect(result).toEqual(['web_search'])
      })

      test('should add all tools when starting with null (all selected)', async () => {
        const result = await toolSelection.handlePluginToggle(null, 'filesystem')
        expect(result).toEqual(['web_search', 'tool1_1', 'tool2_1', 'tool3_2', 'tool4_2'])
      })

      test('should return null when all tools end up selected', async () => {
        const selection = ['web_search', 'tool1_1', 'tool2_1', 'tool3_2', 'tool4_2']
        const result = await toolSelection.handlePluginToggle(selection, 'filesystem')
        expect(result).toBeNull()
      })
    })
  })

  describe('handleAllServerToolsToggle', () => {
    test('should unselect all server tools when all are selected', async () => {
      const servers = await window.api.mcp.getAllServersWithTools()
      const allSelected = ['web_search', 'tool1_1', 'tool2_1', 'tool3_2', 'tool4_2']
      const result = await toolSelection.handleAllServerToolsToggle(allSelected, servers[0])
      expect(result).toEqual(['web_search', 'tool3_2', 'tool4_2'])
    })

    test('should select all server tools when none are selected', async () => {
      const servers = await window.api.mcp.getAllServersWithTools()
      const noneSelected = ['web_search', 'tool3_2', 'tool4_2']
      const result = await toolSelection.handleAllServerToolsToggle(noneSelected, servers[0])
      expect(result).toEqual(['web_search', 'tool3_2', 'tool4_2', 'tool1_1', 'tool2_1'])
    })

    test('should select all server tools when some are selected', async () => {
      const servers = await window.api.mcp.getAllServersWithTools()
      const someSelected = ['web_search', 'tool1_1', 'tool3_2', 'tool4_2']
      const result = await toolSelection.handleAllServerToolsToggle(someSelected, servers[0])
      expect(result).toEqual(['web_search', 'tool3_2', 'tool4_2', 'tool1_1', 'tool2_1'])
    })

    test('should handle null selection', async () => {
      const servers = await window.api.mcp.getAllServersWithTools()
      const result = await toolSelection.handleAllServerToolsToggle(null, servers[0])
      expect(result).toEqual(['web_search', 'filesystem_list', 'filesystem_read', 'filesystem_write', 'tool3_2', 'tool4_2'])
    })
  })

  describe('handleServerToolToggle', () => {
    test('should add tool when not selected', async () => {
      const servers = await window.api.mcp.getAllServersWithTools()
      const tool: McpToolUnique = { uuid: 'tool1_1', name: 'tool1', description: 'description1' }
      const selection = ['web_search', 'tool2_1']
      const result = await toolSelection.handleServerToolToggle(selection, servers[0], tool)
      expect(result).toEqual(['web_search', 'tool2_1', 'tool1_1'])
    })

    test('should remove tool when selected', async () => {
      const servers = await window.api.mcp.getAllServersWithTools()
      const tool: McpToolUnique = { uuid: 'tool1_1', name: 'tool1', description: 'description1' }
      const selection = ['web_search', 'tool1_1', 'tool2_1']
      const result = await toolSelection.handleServerToolToggle(selection, servers[0], tool)
      expect(result).toEqual(['web_search', 'tool2_1'])
    })

    test('should handle null selection by removing tool', async () => {
      const servers = await window.api.mcp.getAllServersWithTools()
      const tool: McpToolUnique = { uuid: 'tool1_1', name: 'tool1', description: 'description1' }
      const result = await toolSelection.handleServerToolToggle(null, servers[0], tool)
      expect(result).toEqual(['web_search', 'filesystem_list', 'filesystem_read', 'filesystem_write', 'tool2_1', 'tool3_2', 'tool4_2'])
    })

    test('should return null when all tools end up selected', async () => {
      const servers = await window.api.mcp.getAllServersWithTools()
      const tool: McpToolUnique = { uuid: 'tool1_1', name: 'tool1', description: 'description1' }
      const selection = ['web_search', 'filesystem_list', 'filesystem_read', 'filesystem_write', 'tool2_1', 'tool3_2', 'tool4_2']
      const result = await toolSelection.handleServerToolToggle(selection, servers[0], tool)
      expect(result).toBeNull()
    })
  })

  describe('handleSelectAllTools', () => {
    test('should return null (all tools selected) when no filter provided', async () => {
      const result = await toolSelection.handleSelectAllTools()
      expect(result).toBeNull()
    })

    test('should return null when visibleToolIds is null', async () => {
      const result = await toolSelection.handleSelectAllTools(null)
      expect(result).toBeNull()
    })

    test('should return filtered tools when visibleToolIds is provided', async () => {
      const visibleIds = ['web_search', 'tool1_1']
      const result = await toolSelection.handleSelectAllTools(visibleIds)
      expect(result).toEqual(['web_search', 'tool1_1'])
    })

    test('should return empty array when visibleToolIds is empty', async () => {
      const visibleIds: string[] = []
      const result = await toolSelection.handleSelectAllTools(visibleIds)
      expect(result).toEqual([])
    })
  })

  describe('handleUnselectAllTools', () => {
    test('should return empty array (no tools selected) when no filter provided', async () => {
      const result = await toolSelection.handleUnselectAllTools()
      expect(result).toEqual([])
    })

    test('should return empty array when visibleToolIds is null', async () => {
      const result = await toolSelection.handleUnselectAllTools(null)
      expect(result).toEqual([])
    })

    test('should return all tools except visible ones when visibleToolIds is provided', async () => {
      const visibleIds = ['web_search', 'tool1_1']
      const result = await toolSelection.handleUnselectAllTools(visibleIds)
      expect(result).toEqual(['filesystem_list', 'filesystem_read', 'filesystem_write', 'tool2_1', 'tool3_2', 'tool4_2'])
    })

    test('should return null (all tools selected) when visibleToolIds is empty', async () => {
      const visibleIds: string[] = []
      const result = await toolSelection.handleUnselectAllTools(visibleIds)
      // When filter shows 0 items, unselecting 0 tools means all remain selected (null)
      expect(result).toBeNull()
    })
  })

  describe('handleSelectAllPlugins', () => {
    test('should return null when selection is null (all already selected)', async () => {
      const result = await toolSelection.handleSelectAllPlugins(null)
      expect(result).toBeNull()
    })

    test('should add missing plugins to selection', async () => {
      const selection = ['tool1_1', 'web_search']
      const result = await toolSelection.handleSelectAllPlugins(selection)
      expect(result).toEqual(['tool1_1', 'web_search', 'filesystem_list', 'filesystem_read', 'filesystem_write'])
    })

    test('should return null when all tools end up selected', async () => {
      const selection = ['tool1_1', 'tool2_1', 'tool3_2', 'tool4_2', 'web_search']
      const result = await toolSelection.handleSelectAllPlugins(selection)
      expect(result).toBeNull()
    })

    test('should return selection when no plugins are selected', async () => {
      const selection = ['tool1_1', 'tool2_1']
      const result = await toolSelection.handleSelectAllPlugins(selection)
      expect(result).toEqual(['tool1_1', 'tool2_1', 'web_search', 'filesystem_list', 'filesystem_read', 'filesystem_write'])
    })

    describe('with filtering', () => {
      test('should return null when selection is null and no visible plugins specified', async () => {
        const result = await toolSelection.handleSelectAllPlugins(null, null)
        expect(result).toBeNull()
      })

      test('should return null when selection is null and visible plugins result in all tools selected', async () => {
        const visiblePluginIds = ['search'] // plugin name, not tool name
        const result = await toolSelection.handleSelectAllPlugins(null, visiblePluginIds)
        // When selection is null and there are visible plugins, it starts with all tools and adds the visible plugin
        // Since web_search is already in all tools, the result should be null (all tools selected)
        expect(result).toBeNull()
      })

      test('should add only visible plugins to existing selection', async () => {
        const selection = ['tool1_1', 'tool2_1']
        const visiblePluginIds = ['search'] // only search plugin visible
        const result = await toolSelection.handleSelectAllPlugins(selection, visiblePluginIds)
        expect(result).toEqual(['tool1_1', 'tool2_1', 'web_search'])
      })

      test('should add multiple visible plugins to existing selection', async () => {
        const selection = ['tool1_1']
        const visiblePluginIds = ['search', 'filesystem']
        const result = await toolSelection.handleSelectAllPlugins(selection, visiblePluginIds)
        expect(result).toEqual(['tool1_1', 'web_search', 'filesystem_list', 'filesystem_read', 'filesystem_write'])
      })

      test('should not duplicate existing plugins when filtering', async () => {
        const selection = ['tool1_1', 'web_search']
        const visiblePluginIds = ['search', 'filesystem']
        const result = await toolSelection.handleSelectAllPlugins(selection, visiblePluginIds)
        expect(result).toEqual(['tool1_1', 'web_search', 'filesystem_list', 'filesystem_read', 'filesystem_write'])
      })

      test('should return existing selection when no visible plugins match', async () => {
        const selection = ['tool1_1', 'tool2_1']
        const visiblePluginIds = ['nonexistent']
        const result = await toolSelection.handleSelectAllPlugins(selection, visiblePluginIds)
        expect(result).toEqual(['tool1_1', 'tool2_1'])
      })

      test('should handle empty visible plugins array', async () => {
        const selection = ['tool1_1', 'tool2_1']
        const visiblePluginIds: string[] = []
        const result = await toolSelection.handleSelectAllPlugins(selection, visiblePluginIds)
        expect(result).toEqual(['tool1_1', 'tool2_1'])
      })
    })
  })

  describe('handleUnselectAllPlugins', () => {
    test('should remove all plugins from selection', async () => {
      const selection = ['web_search', 'filesystem_list', 'filesystem_read', 'filesystem_write', 'tool1_1', 'tool2_1']
      const result = await toolSelection.handleUnselectAllPlugins(selection)
      expect(result).toEqual(['tool1_1', 'tool2_1'])
    })

    test('should handle null selection by getting all tools first then removing plugins', async () => {
      const result = await toolSelection.handleUnselectAllPlugins(null)
      expect(result).toEqual(['tool1_1', 'tool2_1', 'tool3_2', 'tool4_2'])
    })

    test('should return empty array when only plugins are selected', async () => {
      const selection = ['web_search', 'filesystem_list', 'filesystem_read', 'filesystem_write']
      const result = await toolSelection.handleUnselectAllPlugins(selection)
      expect(result).toEqual([])
    })

    describe('with filtering', () => {
      test('should remove all plugins when visiblePluginIds is null', async () => {
        const selection = ['web_search', 'filesystem_list', 'filesystem_read', 'filesystem_write', 'tool1_1', 'tool2_1']
        const result = await toolSelection.handleUnselectAllPlugins(selection, null)
        expect(result).toEqual(['tool1_1', 'tool2_1'])
      })

      test('should remove only visible plugins from selection', async () => {
        const selection = ['web_search', 'filesystem_list', 'filesystem_read', 'filesystem_write', 'tool1_1', 'tool2_1']
        const visiblePluginIds = ['search'] // only search plugin visible
        const result = await toolSelection.handleUnselectAllPlugins(selection, visiblePluginIds)
        expect(result).toEqual(['filesystem_list', 'filesystem_read', 'filesystem_write', 'tool1_1', 'tool2_1'])
      })

      test('should remove multiple visible plugins from selection', async () => {
        const selection = ['web_search', 'filesystem_list', 'filesystem_read', 'filesystem_write', 'tool1_1', 'tool2_1']
        const visiblePluginIds = ['search', 'filesystem'] // both plugins visible
        const result = await toolSelection.handleUnselectAllPlugins(selection, visiblePluginIds)
        expect(result).toEqual(['tool1_1', 'tool2_1'])
      })

      test('should handle null selection and visible plugins by removing only visible plugins', async () => {
        const visiblePluginIds = ['search'] // only search plugin visible
        const result = await toolSelection.handleUnselectAllPlugins(null, visiblePluginIds)
        expect(result).toEqual(['filesystem_list', 'filesystem_read', 'filesystem_write', 'tool1_1', 'tool2_1', 'tool3_2', 'tool4_2'])
      })

      test('should return selection unchanged when no visible plugins match', async () => {
        const selection = ['web_search', 'filesystem_list', 'filesystem_read', 'filesystem_write', 'tool1_1', 'tool2_1']
        const visiblePluginIds = ['nonexistent']
        const result = await toolSelection.handleUnselectAllPlugins(selection, visiblePluginIds)
        expect(result).toEqual(['web_search', 'filesystem_list', 'filesystem_read', 'filesystem_write', 'tool1_1', 'tool2_1'])
      })

      test('should handle empty visible plugins array', async () => {
        const selection = ['web_search', 'filesystem_list', 'filesystem_read', 'filesystem_write', 'tool1_1', 'tool2_1']
        const visiblePluginIds: string[] = []
        const result = await toolSelection.handleUnselectAllPlugins(selection, visiblePluginIds)
        expect(result).toEqual(['web_search', 'filesystem_list', 'filesystem_read', 'filesystem_write', 'tool1_1', 'tool2_1'])
      })
    })
  })

  describe('handleSelectAllServerTools', () => {
    test('should return null when selection is null (all already selected)', async () => {
      const servers = await window.api.mcp.getAllServersWithTools()
      const result = await toolSelection.handleSelectAllServerTools(null, servers[0])
      expect(result).toBeNull()
    })

    test('should add missing server tools to selection', async () => {
      const servers = await window.api.mcp.getAllServersWithTools()
      const selection = ['web_search', 'tool1_1', 'tool3_2', 'tool4_2']
      const result = await toolSelection.handleSelectAllServerTools(selection, servers[0])
      expect(result).toEqual(['web_search', 'tool1_1', 'tool3_2', 'tool4_2', 'tool2_1'])
    })

    test('should not duplicate existing tools', async () => {
      const servers = await window.api.mcp.getAllServersWithTools()
      const selection = ['web_search', 'tool1_1', 'tool2_1']
      const result = await toolSelection.handleSelectAllServerTools(selection, servers[0])
      expect(result).toEqual(['web_search', 'tool1_1', 'tool2_1'])
    })

    test('should return null when all tools end up selected', async () => {
      const servers = await window.api.mcp.getAllServersWithTools()
      const selection = ['web_search', 'filesystem_list', 'filesystem_read', 'filesystem_write', 'tool3_2', 'tool4_2']
      const result = await toolSelection.handleSelectAllServerTools(selection, servers[0])
      expect(result).toBeNull()
    })

    describe('with filtering', () => {
      test('should return null when selection is null and no visible tools specified', async () => {
        const servers = await window.api.mcp.getAllServersWithTools()
        const result = await toolSelection.handleSelectAllServerTools(null, servers[0], null)
        expect(result).toBeNull()
      })

      test('should start with all tools and add only visible server tools when selection is null', async () => {
        const servers = await window.api.mcp.getAllServersWithTools()
        const visibleToolIds = ['tool1_1'] // only one server tool visible
        const result = await toolSelection.handleSelectAllServerTools(null, servers[0], visibleToolIds)
        // Should return null because all tools end up selected (starts with all tools, tool1_1 already included)
        expect(result).toBeNull()
      })

      test('should add only visible server tools to existing selection', async () => {
        const servers = await window.api.mcp.getAllServersWithTools()
        const selection = ['web_search', 'tool3_2', 'tool4_2']
        const visibleToolIds = ['tool1_1'] // only tool1_1 visible
        const result = await toolSelection.handleSelectAllServerTools(selection, servers[0], visibleToolIds)
        expect(result).toEqual(['web_search', 'tool3_2', 'tool4_2', 'tool1_1'])
      })

      test('should add multiple visible server tools to existing selection', async () => {
        const servers = await window.api.mcp.getAllServersWithTools()
        const selection = ['web_search']
        const visibleToolIds = ['tool1_1', 'tool2_1'] // both server tools visible
        const result = await toolSelection.handleSelectAllServerTools(selection, servers[0], visibleToolIds)
        expect(result).toEqual(['web_search', 'tool1_1', 'tool2_1'])
      })

      test('should not duplicate existing server tools when filtering', async () => {
        const servers = await window.api.mcp.getAllServersWithTools()
        const selection = ['web_search', 'tool1_1']
        const visibleToolIds = ['tool1_1', 'tool2_1'] // both server tools visible
        const result = await toolSelection.handleSelectAllServerTools(selection, servers[0], visibleToolIds)
        expect(result).toEqual(['web_search', 'tool1_1', 'tool2_1'])
      })

      test('should return existing selection when no visible server tools match', async () => {
        const servers = await window.api.mcp.getAllServersWithTools()
        const selection = ['web_search', 'tool3_2']
        const visibleToolIds = ['nonexistent'] // no matching tools
        const result = await toolSelection.handleSelectAllServerTools(selection, servers[0], visibleToolIds)
        expect(result).toEqual(['web_search', 'tool3_2'])
      })

      test('should handle empty visible tools array', async () => {
        const servers = await window.api.mcp.getAllServersWithTools()
        const selection = ['web_search', 'tool3_2']
        const visibleToolIds: string[] = []
        const result = await toolSelection.handleSelectAllServerTools(selection, servers[0], visibleToolIds)
        expect(result).toEqual(['web_search', 'tool3_2'])
      })
    })
  })

  describe('handleUnselectAllServerTools', () => {
    test('should remove all server tools from selection', async () => {
      const servers = await window.api.mcp.getAllServersWithTools()
      const selection = ['web_search', 'tool1_1', 'tool2_1', 'tool3_2', 'tool4_2']
      const result = await toolSelection.handleUnselectAllServerTools(selection, servers[0])
      expect(result).toEqual(['web_search', 'tool3_2', 'tool4_2'])
    })

    test('should handle null selection by getting all tools first then removing server tools', async () => {
      const servers = await window.api.mcp.getAllServersWithTools()
      const result = await toolSelection.handleUnselectAllServerTools(null, servers[0])
      expect(result).toEqual(['web_search', 'filesystem_list', 'filesystem_read', 'filesystem_write', 'tool3_2', 'tool4_2'])
    })

    test('should return empty array when only server tools are selected', async () => {
      const servers = await window.api.mcp.getAllServersWithTools()
      const selection = ['tool1_1', 'tool2_1']
      const result = await toolSelection.handleUnselectAllServerTools(selection, servers[0])
      expect(result).toEqual([])
    })

    describe('with filtering', () => {
      test('should remove all server tools when visibleToolIds is null', async () => {
        const servers = await window.api.mcp.getAllServersWithTools()
        const selection = ['web_search', 'tool1_1', 'tool2_1', 'tool3_2', 'tool4_2']
        const result = await toolSelection.handleUnselectAllServerTools(selection, servers[0], null)
        expect(result).toEqual(['web_search', 'tool3_2', 'tool4_2'])
      })

      test('should remove only visible server tools from selection', async () => {
        const servers = await window.api.mcp.getAllServersWithTools()
        const selection = ['web_search', 'tool1_1', 'tool2_1', 'tool3_2']
        const visibleToolIds = ['tool1_1'] // only tool1_1 visible
        const result = await toolSelection.handleUnselectAllServerTools(selection, servers[0], visibleToolIds)
        expect(result).toEqual(['web_search', 'tool2_1', 'tool3_2'])
      })

      test('should remove multiple visible server tools from selection', async () => {
        const servers = await window.api.mcp.getAllServersWithTools()
        const selection = ['web_search', 'tool1_1', 'tool2_1', 'tool3_2']
        const visibleToolIds = ['tool1_1', 'tool2_1'] // both server tools visible
        const result = await toolSelection.handleUnselectAllServerTools(selection, servers[0], visibleToolIds)
        expect(result).toEqual(['web_search', 'tool3_2'])
      })

      test('should handle null selection and visible tools by removing only visible server tools', async () => {
        const servers = await window.api.mcp.getAllServersWithTools()
        const visibleToolIds = ['tool1_1'] // only tool1_1 visible
        const result = await toolSelection.handleUnselectAllServerTools(null, servers[0], visibleToolIds)
        expect(result).toEqual(['web_search', 'filesystem_list', 'filesystem_read', 'filesystem_write', 'tool2_1', 'tool3_2', 'tool4_2'])
      })

      test('should return selection unchanged when no visible server tools match', async () => {
        const servers = await window.api.mcp.getAllServersWithTools()
        const selection = ['web_search', 'tool1_1', 'tool2_1', 'tool3_2']
        const visibleToolIds = ['nonexistent'] // no matching tools
        const result = await toolSelection.handleUnselectAllServerTools(selection, servers[0], visibleToolIds)
        expect(result).toEqual(['web_search', 'tool1_1', 'tool2_1', 'tool3_2'])
      })

      test('should handle empty visible tools array', async () => {
        const servers = await window.api.mcp.getAllServersWithTools()
        const selection = ['web_search', 'tool1_1', 'tool2_1', 'tool3_2']
        const visibleToolIds: string[] = []
        const result = await toolSelection.handleUnselectAllServerTools(selection, servers[0], visibleToolIds)
        expect(result).toEqual(['web_search', 'tool1_1', 'tool2_1', 'tool3_2'])
      })
    })
  })
})

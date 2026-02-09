
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { App , app } from 'electron'
import fs from 'fs'
import {
  hasOldToolSuffix,
  isMigrationCompleted,
  markMigrationCompleted,
  migrateMcpToolNames,
  migrateWorkspaceMcpToolNames,
  normalizePromptToolNames,
  stripOldToolSuffix
} from '@/main/migrations/mcp_tool_names'
import { clearAppSettingsCache } from '@/main/config'

// Mock electron
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/mock/userData'),
  },
  safeStorage: {
    isEncryptionAvailable: vi.fn(() => false),
  },
}))

// Mock windows
vi.mock('@main/windows/index', () => ({
  emitIpcEventToAll: vi.fn(),
}))

// We'll mock fs for controlled testing
vi.mock('fs', async (importOriginal) => {
  const actual: typeof fs = await importOriginal() as typeof fs
  const mockWatcher = { close: vi.fn() }
  return {
    default: {
      ...actual,
      existsSync: vi.fn(),
      readdirSync: vi.fn(),
      readFileSync: vi.fn(),
      writeFileSync: vi.fn(),
      statSync: vi.fn(() => ({ isFile: () => true, isDirectory: () => true })),
      mkdirSync: vi.fn(),
      watch: vi.fn(() => mockWatcher),
    },
    existsSync: vi.fn(),
    readdirSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    statSync: vi.fn(() => ({ isFile: () => true, isDirectory: () => true })),
    mkdirSync: vi.fn(),
    watch: vi.fn(() => mockWatcher),
  }
})


const mockApp = app as unknown as App

// Helper to create agent JSON (witsy uses .json, not .ejson)
const createAgentJson = (uuid: string, tools: string[][], prompts?: string[]) => {
  return JSON.stringify({
    uuid,
    source: 'witsy',
    createdAt: 1000000000000,
    updatedAt: 1000000005000,
    name: `Agent ${uuid}`,
    description: 'Test agent',
    type: 'runnable',
    owner: 'user',
    engine: 'openai',
    model: 'gpt-4',
    modelOpts: {},
    disableStreaming: true,
    locale: 'en',
    instructions: 'Test instructions',
    parameters: [],
    steps: tools.map((t, i) => ({ tools: t, agents: [] as any[], prompt: prompts?.[i] ?? 'test prompt' })),
  })
}

describe('stripOldToolSuffix', () => {

  it('strips ___xxxx suffix from tool name', () => {
    expect(stripOldToolSuffix('list_files___90ab')).toBe('list_files')
    expect(stripOldToolSuffix('create_branch___1234')).toBe('create_branch')
    expect(stripOldToolSuffix('tool___abcd')).toBe('tool')
  })

  it('handles tool names with underscores', () => {
    expect(stripOldToolSuffix('my_cool_tool___90ab')).toBe('my_cool_tool')
    expect(stripOldToolSuffix('a_b_c_d___1234')).toBe('a_b_c_d')
  })

  it('preserves tool names without suffix', () => {
    expect(stripOldToolSuffix('list_files')).toBe('list_files')
    expect(stripOldToolSuffix('create_branch')).toBe('create_branch')
    expect(stripOldToolSuffix('tool')).toBe('tool')
  })

  it('preserves tool names with partial suffix patterns', () => {
    expect(stripOldToolSuffix('tool___abc')).toBe('tool___abc')    // 3 chars
    expect(stripOldToolSuffix('tool___ab')).toBe('tool___ab')      // 2 chars
    expect(stripOldToolSuffix('tool___abcde')).toBe('tool___abcde') // 5 chars
  })

  it('handles edge cases', () => {
    expect(stripOldToolSuffix('')).toBe('')
    expect(stripOldToolSuffix('___1234')).toBe('')
    expect(stripOldToolSuffix('a___1234')).toBe('a')
  })

  it('only strips the last suffix if multiple patterns exist', () => {
    expect(stripOldToolSuffix('tool___name___90ab')).toBe('tool___name')
  })

})

describe('hasOldToolSuffix', () => {

  it('returns true for tool names with ___xxxx suffix', () => {
    expect(hasOldToolSuffix('list_files___90ab')).toBe(true)
    expect(hasOldToolSuffix('create_branch___1234')).toBe(true)
    expect(hasOldToolSuffix('tool___abcd')).toBe(true)
    expect(hasOldToolSuffix('tool___ABCD')).toBe(true)
    expect(hasOldToolSuffix('tool___12ab')).toBe(true)
  })

  it('returns false for tool names without suffix', () => {
    expect(hasOldToolSuffix('list_files')).toBe(false)
    expect(hasOldToolSuffix('create_branch')).toBe(false)
    expect(hasOldToolSuffix('tool')).toBe(false)
  })

  it('returns false for partial suffix patterns', () => {
    expect(hasOldToolSuffix('tool___abc')).toBe(false)   // 3 chars
    expect(hasOldToolSuffix('tool___ab')).toBe(false)    // 2 chars
    expect(hasOldToolSuffix('tool___abcde')).toBe(false) // 5 chars
    expect(hasOldToolSuffix('tool__1234')).toBe(false)   // 2 underscores
    expect(hasOldToolSuffix('tool_1234')).toBe(false)    // 1 underscore
  })

  it('handles edge cases', () => {
    expect(hasOldToolSuffix('')).toBe(false)
    expect(hasOldToolSuffix('___1234')).toBe(true)
    expect(hasOldToolSuffix('a___1234')).toBe(true)
  })

})

describe('migrateWorkspaceMcpToolNames', () => {

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('migrates agent with old suffix tools', async () => {
    const agent = createAgentJson('agent-1', [
      ['list_files___90ab', 'create_branch___1234'],
      ['regular_tool', 'another___5678']
    ])

    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readdirSync).mockImplementation((path: any) => {
      if (path.includes('agents')) return ['agent-1.json'] as any
      return [] as any
    })
    vi.mocked(fs.readFileSync).mockImplementation((path: any) => {
      if (path.includes('agent-1')) return agent
      if (path.includes('history.json')) return JSON.stringify({ version: 1, chats: [], folders: [] })
      return ''
    })
    vi.mocked(fs.statSync).mockReturnValue({ isFile: () => true, isDirectory: () => true } as any)

    const count = await migrateWorkspaceMcpToolNames(mockApp, 'workspace-1')

    expect(count).toBe(3) // 3 tools with old suffix
    // Agent saved
    const agentWrite = vi.mocked(fs.writeFileSync).mock.calls.find(
      call => (call[0] as string).includes('agent-1.json')
    )
    expect(agentWrite).toBeTruthy()
  })

  it('migrates agent prompts by normalizing tool names', async () => {
    const agent = createAgentJson(
      'agent-1',
      [['list_files___90ab', 'create_branch___1234']],
      ['Use list_files___90ab to list files, then create_branch___1234 to create a branch']
    )

    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readdirSync).mockImplementation((path: any) => {
      if (path.includes('agents')) return ['agent-1.json'] as any
      return [] as any
    })
    vi.mocked(fs.readFileSync).mockImplementation((path: any) => {
      if (path.includes('agent-1')) return agent
      if (path.includes('history.json')) return JSON.stringify({ version: 1, chats: [], folders: [] })
      return ''
    })
    vi.mocked(fs.statSync).mockReturnValue({ isFile: () => true, isDirectory: () => true } as any)

    const count = await migrateWorkspaceMcpToolNames(mockApp, 'workspace-1')

    expect(count).toBe(2) // 2 tools with old suffix
    const agentWrite = vi.mocked(fs.writeFileSync).mock.calls.find(
      call => (call[0] as string).includes('agent-1.json')
    )
    expect(agentWrite).toBeTruthy()
  })

  it('does not save if no tools need migration', async () => {
    const agent = createAgentJson('agent-1', [['clean_tool1', 'clean_tool2']])

    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readdirSync).mockImplementation((path: any) => {
      if (path.includes('agents')) return ['agent-1.json'] as any
      return [] as any
    })
    vi.mocked(fs.readFileSync).mockImplementation((path: any) => {
      if (path.includes('agent-1')) return agent
      if (path.includes('history.json')) return JSON.stringify({ version: 1, chats: [], folders: [] })
      return ''
    })
    vi.mocked(fs.statSync).mockReturnValue({ isFile: () => true, isDirectory: () => true } as any)

    const count = await migrateWorkspaceMcpToolNames(mockApp, 'workspace-1')

    expect(count).toBe(0)
    expect(fs.writeFileSync).not.toHaveBeenCalled()
  })

  it('handles agent with empty tools array', async () => {
    const agent = createAgentJson('agent-1', [[]])

    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readdirSync).mockImplementation((path: any) => {
      if (path.includes('agents')) return ['agent-1.json'] as any
      return [] as any
    })
    vi.mocked(fs.readFileSync).mockImplementation((path: any) => {
      if (path.includes('agent-1')) return agent
      if (path.includes('history.json')) return JSON.stringify({ version: 1, chats: [], folders: [] })
      return ''
    })
    vi.mocked(fs.statSync).mockReturnValue({ isFile: () => true, isDirectory: () => true } as any)

    const count = await migrateWorkspaceMcpToolNames(mockApp, 'workspace-1')

    expect(count).toBe(0)
    expect(fs.writeFileSync).not.toHaveBeenCalled()
  })

  it('handles agent with null tools', async () => {
    const agent = JSON.stringify({
      uuid: 'agent-1',
      source: 'witsy',
      createdAt: 1000000000000,
      updatedAt: 1000000005000,
      name: 'Agent agent-1',
      steps: [{ tools: null, agents: [], prompt: 'test' }],
    })

    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readdirSync).mockImplementation((path: any) => {
      if (path.includes('agents')) return ['agent-1.json'] as any
      return [] as any
    })
    vi.mocked(fs.readFileSync).mockImplementation((path: any) => {
      if (path.includes('agent-1')) return agent
      if (path.includes('history.json')) return JSON.stringify({ version: 1, chats: [], folders: [] })
      return ''
    })
    vi.mocked(fs.statSync).mockReturnValue({ isFile: () => true, isDirectory: () => true } as any)

    const count = await migrateWorkspaceMcpToolNames(mockApp, 'workspace-1')

    expect(count).toBe(0)
    expect(fs.writeFileSync).not.toHaveBeenCalled()
  })

  it('migrates multiple agents in same workspace', async () => {
    const agent1 = createAgentJson('agent-1', [['tool1___90ab']])
    const agent2 = createAgentJson('agent-2', [['tool2___1234']])
    const agent3 = createAgentJson('agent-3', [['clean_tool']])

    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readdirSync).mockImplementation((path: any) => {
      if (path.includes('agents')) return ['agent-1.json', 'agent-2.json', 'agent-3.json'] as any
      return [] as any
    })
    vi.mocked(fs.readFileSync).mockImplementation((path: any) => {
      if (path.includes('agent-1')) return agent1
      if (path.includes('agent-2')) return agent2
      if (path.includes('agent-3')) return agent3
      if (path.includes('history.json')) return JSON.stringify({ version: 1, chats: [], folders: [] })
      return ''
    })
    vi.mocked(fs.statSync).mockReturnValue({ isFile: () => true, isDirectory: () => true } as any)

    const count = await migrateWorkspaceMcpToolNames(mockApp, 'workspace-1')

    expect(count).toBe(2) // 2 agents with old suffix tools
    const agentWrites = vi.mocked(fs.writeFileSync).mock.calls.filter(
      call => (call[0] as string).includes('.json') && (call[0] as string).includes('agent')
    )
    expect(agentWrites).toHaveLength(2) // Only agents that needed migration
  })

  it('handles agent with multiple steps each with multiple tools', async () => {
    const agent = createAgentJson('agent-1', [
      ['step1_tool1___aaaa', 'step1_tool2___bbbb', 'step1_clean'],
      ['step2_tool1___cccc'],
      ['step3_clean1', 'step3_clean2'],
      ['step4_tool1___dddd', 'step4_tool2___eeee', 'step4_tool3___ffff'],
    ])

    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readdirSync).mockImplementation((path: any) => {
      if (path.includes('agents')) return ['agent-1.json'] as any
      return [] as any
    })
    vi.mocked(fs.readFileSync).mockImplementation((path: any) => {
      if (path.includes('agent-1')) return agent
      if (path.includes('history.json')) return JSON.stringify({ version: 1, chats: [], folders: [] })
      return ''
    })
    vi.mocked(fs.statSync).mockReturnValue({ isFile: () => true, isDirectory: () => true } as any)

    const count = await migrateWorkspaceMcpToolNames(mockApp, 'workspace-1')

    // Count: step1=2, step2=1, step3=0, step4=3 = 6 total
    expect(count).toBe(6)
    const agentWrite = vi.mocked(fs.writeFileSync).mock.calls.find(
      call => (call[0] as string).includes('agent-1.json')
    )
    expect(agentWrite).toBeTruthy()
  })

})

describe('migrateWorkspaceMcpToolNames - history migration', () => {

  beforeEach(() => {
    vi.clearAllMocks()
  })

  // Helper to create history JSON
  const createHistoryJson = (
    chats: { uuid: string, tools: string[] }[],
    folders: { id: string, defaults?: { tools: string[] } }[]
  ) => {
    return {
      version: 1,
      chats: chats.map(c => ({
        uuid: c.uuid,
        title: `Chat ${c.uuid}`,
        createdAt: 1000000000000,
        lastModified: 1000000000000,
        tools: c.tools,
        messages: [] as any[]
      })),
      folders: folders.map(f => ({
        id: f.id,
        name: `Folder ${f.id}`,
        chats: [] as any[],
        defaults: f.defaults
      }))
    }
  }

  it('migrates chat tools with old suffixes', async () => {
    const history = createHistoryJson(
      [
        { uuid: 'chat-1', tools: ['chat_tool___90ab', 'clean_tool'] },
        { uuid: 'chat-2', tools: ['another_chat_tool___1234'] }
      ],
      []
    )

    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readdirSync).mockImplementation((path: any) => {
      if (path.includes('agents')) return [] as any
      return [] as any
    })
    vi.mocked(fs.readFileSync).mockImplementation((path: any) => {
      if (path.includes('history.json')) return JSON.stringify(history)
      return ''
    })

    const count = await migrateWorkspaceMcpToolNames(mockApp, 'workspace-1')

    expect(count).toBe(2) // chat_tool + another_chat_tool

    const historyWrite = vi.mocked(fs.writeFileSync).mock.calls.find(
      call => (call[0] as string).includes('history.json')
    )
    expect(historyWrite).toBeTruthy()
  })

  it('migrates folder defaults tools with old suffixes', async () => {
    const history = createHistoryJson(
      [],
      [
        { id: 'folder-1', defaults: { tools: ['folder_tool___abcd', 'clean_tool'] } },
        { id: 'folder-2', defaults: { tools: ['another_folder_tool___5678'] } }
      ]
    )

    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readdirSync).mockImplementation((path: any) => {
      if (path.includes('agents')) return [] as any
      return [] as any
    })
    vi.mocked(fs.readFileSync).mockImplementation((path: any) => {
      if (path.includes('history.json')) return JSON.stringify(history)
      return ''
    })

    const count = await migrateWorkspaceMcpToolNames(mockApp, 'workspace-1')

    expect(count).toBe(2) // folder_tool + another_folder_tool

    const historyWrite = vi.mocked(fs.writeFileSync).mock.calls.find(
      call => (call[0] as string).includes('history.json')
    )
    expect(historyWrite).toBeTruthy()
  })

  it('migrates both chats and folder defaults together', async () => {
    const history = createHistoryJson(
      [{ uuid: 'chat-1', tools: ['chat_tool___1111'] }],
      [{ id: 'folder-1', defaults: { tools: ['folder_tool___2222'] } }]
    )

    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readdirSync).mockImplementation((path: any) => {
      if (path.includes('agents')) return [] as any
      return [] as any
    })
    vi.mocked(fs.readFileSync).mockImplementation((path: any) => {
      if (path.includes('history.json')) return JSON.stringify(history)
      return ''
    })

    const count = await migrateWorkspaceMcpToolNames(mockApp, 'workspace-1')

    expect(count).toBe(2) // chat_tool + folder_tool
  })

  it('does not save history if no tools need migration', async () => {
    const history = createHistoryJson(
      [{ uuid: 'chat-1', tools: ['clean_tool'] }],
      [{ id: 'folder-1', defaults: { tools: ['another_clean_tool'] } }]
    )

    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readdirSync).mockImplementation((path: any) => {
      if (path.includes('agents')) return [] as any
      return [] as any
    })
    vi.mocked(fs.readFileSync).mockImplementation((path: any) => {
      if (path.includes('history.json')) return JSON.stringify(history)
      return ''
    })

    const count = await migrateWorkspaceMcpToolNames(mockApp, 'workspace-1')

    expect(count).toBe(0)
    const historyWrite = vi.mocked(fs.writeFileSync).mock.calls.find(
      call => (call[0] as string).includes('history.json')
    )
    expect(historyWrite).toBeUndefined()
  })

  it('handles folders without defaults', async () => {
    const history = createHistoryJson(
      [],
      [
        { id: 'folder-1' },  // No defaults
        { id: 'folder-2', defaults: { tools: ['folder_tool___abcd'] } }
      ]
    )

    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readdirSync).mockImplementation((path: any) => {
      if (path.includes('agents')) return [] as any
      return [] as any
    })
    vi.mocked(fs.readFileSync).mockImplementation((path: any) => {
      if (path.includes('history.json')) return JSON.stringify(history)
      return ''
    })

    const count = await migrateWorkspaceMcpToolNames(mockApp, 'workspace-1')

    expect(count).toBe(1) // folder_tool from folder-2
  })

  it('handles empty history', async () => {
    const history = createHistoryJson([], [])

    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readdirSync).mockImplementation((path: any) => {
      if (path.includes('agents')) return [] as any
      return [] as any
    })
    vi.mocked(fs.readFileSync).mockImplementation((path: any) => {
      if (path.includes('history.json')) return JSON.stringify(history)
      return ''
    })

    const count = await migrateWorkspaceMcpToolNames(mockApp, 'workspace-1')

    expect(count).toBe(0)
  })

  it('handles missing history file', async () => {
    vi.mocked(fs.existsSync).mockImplementation((path: any) => {
      if (typeof path === 'string' && path.includes('history.json')) return false
      return true
    })
    vi.mocked(fs.readdirSync).mockImplementation((path: any) => {
      if (path.includes('agents')) return [] as any
      return [] as any
    })
    vi.mocked(fs.readFileSync).mockImplementation(() => '')

    const count = await migrateWorkspaceMcpToolNames(mockApp, 'workspace-1')

    expect(count).toBe(0)
  })

  it('migrates agents and history in same workspace', async () => {
    const agent = createAgentJson('agent-1', [['agent_tool___aaaa']])
    const history = createHistoryJson(
      [{ uuid: 'chat-1', tools: ['chat_tool___cccc'] }],
      [{ id: 'folder-1', defaults: { tools: ['folder_tool___dddd'] } }]
    )

    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readdirSync).mockImplementation((path: any) => {
      if (path.includes('agents')) return ['agent-1.json'] as any
      return [] as any
    })
    vi.mocked(fs.readFileSync).mockImplementation((path: any) => {
      if (path.includes('agent-1')) return agent
      if (path.includes('history.json')) return JSON.stringify(history)
      return ''
    })
    vi.mocked(fs.statSync).mockReturnValue({ isFile: () => true, isDirectory: () => true } as any)

    const count = await migrateWorkspaceMcpToolNames(mockApp, 'workspace-1')

    expect(count).toBe(3) // agent + chat + folder
    // Agent and history both saved
    const agentWrite = vi.mocked(fs.writeFileSync).mock.calls.find(
      call => (call[0] as string).includes('agent-1.json')
    )
    const historyWrite = vi.mocked(fs.writeFileSync).mock.calls.find(
      call => (call[0] as string).includes('history.json')
    )
    expect(agentWrite).toBeTruthy()
    expect(historyWrite).toBeTruthy()
  })

})

describe('migrateMcpToolNames', () => {

  beforeEach(() => {
    vi.clearAllMocks()
    clearAppSettingsCache()
  })

  it('migrates all workspaces', async () => {
    const agent1 = createAgentJson('agent-1', [['tool___1111']])
    const agent2 = createAgentJson('agent-2', [['tool___2222']])

    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readdirSync).mockImplementation((path: any) => {
      if (path === '/mock/userData/workspaces') {
        return [
          { name: 'ws-1', isDirectory: () => true },
          { name: 'ws-2', isDirectory: () => true },
        ] as any
      }
      if (path.includes('ws-1') && path.includes('agents')) return ['agent-1.json'] as any
      if (path.includes('ws-2') && path.includes('agents')) return ['agent-2.json'] as any
      return [] as any
    })
    vi.mocked(fs.readFileSync).mockImplementation((path: any) => {
      if (path.includes('agent-1')) return agent1
      if (path.includes('agent-2')) return agent2
      if (path.includes('ws-1') && path.includes('workspace.json')) return JSON.stringify({ uuid: 'ws-1', name: 'WS1' })
      if (path.includes('ws-2') && path.includes('workspace.json')) return JSON.stringify({ uuid: 'ws-2', name: 'WS2' })
      if (path.includes('history.json')) return JSON.stringify({ version: 1, chats: [], folders: [] })
      if (path.includes('settings.json')) return JSON.stringify({})
      return ''
    })
    vi.mocked(fs.statSync).mockReturnValue({ isFile: () => true, isDirectory: () => true } as any)

    const count = await migrateMcpToolNames(mockApp)

    expect(count).toBe(2) // 1 tool per workspace
    const agentWrites = vi.mocked(fs.writeFileSync).mock.calls.filter(
      call => (call[0] as string).includes('.json') && (call[0] as string).includes('agent')
    )
    expect(agentWrites).toHaveLength(2)
  })

  it('returns 0 if no workspaces exist', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readdirSync).mockImplementation((path: any) => {
      if (path === '/mock/userData/workspaces') return [] as any
      return [] as any
    })
    vi.mocked(fs.readFileSync).mockImplementation((path: any) => {
      if (path.includes('settings.json')) return JSON.stringify({})
      return ''
    })

    const count = await migrateMcpToolNames(mockApp)

    expect(count).toBe(0)
  })

  it('returns 0 if no tools need migration across all workspaces', async () => {
    const agent = createAgentJson('agent-1', [['clean_tool']])

    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readdirSync).mockImplementation((path: any) => {
      if (path === '/mock/userData/workspaces') {
        return [{ name: 'ws-1', isDirectory: () => true }] as any
      }
      if (path.includes('agents')) return ['agent-1.json'] as any
      return [] as any
    })
    vi.mocked(fs.readFileSync).mockImplementation((path: any) => {
      if (path.includes('agent-1')) return agent
      if (path.includes('workspace.json')) return JSON.stringify({ uuid: 'ws-1', name: 'WS1' })
      if (path.includes('history.json')) return JSON.stringify({ version: 1, chats: [], folders: [] })
      if (path.includes('settings.json')) return JSON.stringify({})
      return ''
    })
    vi.mocked(fs.statSync).mockReturnValue({ isFile: () => true, isDirectory: () => true } as any)

    const count = await migrateMcpToolNames(mockApp)

    expect(count).toBe(0)
    // No agent writes
    const agentWrites = vi.mocked(fs.writeFileSync).mock.calls.filter(
      call => (call[0] as string).includes('agent')
    )
    expect(agentWrites).toHaveLength(0)
  })

  it('skips migration if already completed (returns -1)', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readFileSync).mockImplementation((path: any) => {
      if (path.includes('settings.json')) {
        return JSON.stringify({
          migrations: ['mcp-tool-suffix-removal-v1']
        })
      }
      return ''
    })

    const count = await migrateMcpToolNames(mockApp)

    expect(count).toBe(-1) // Skipped
    expect(fs.writeFileSync).not.toHaveBeenCalled()
  })

  it('marks migration as completed after running', async () => {
    const agent = createAgentJson('agent-1', [['tool___1111']])

    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readdirSync).mockImplementation((path: any) => {
      if (path === '/mock/userData/workspaces') {
        return [{ name: 'ws-1', isDirectory: () => true }] as any
      }
      if (path.includes('agents')) return ['agent-1.json'] as any
      return [] as any
    })
    vi.mocked(fs.readFileSync).mockImplementation((path: any) => {
      if (path.includes('agent-1')) return agent
      if (path.includes('workspace.json')) return JSON.stringify({ uuid: 'ws-1', name: 'WS1' })
      if (path.includes('history.json')) return JSON.stringify({ version: 1, chats: [], folders: [] })
      if (path.includes('settings.json')) return JSON.stringify({})
      return ''
    })
    vi.mocked(fs.statSync).mockReturnValue({ isFile: () => true, isDirectory: () => true } as any)

    await migrateMcpToolNames(mockApp)

    // Check that settings.json was written with migration marker
    const settingsWrites = vi.mocked(fs.writeFileSync).mock.calls.filter(
      call => (call[0] as string).includes('settings.json')
    )
    expect(settingsWrites.length).toBeGreaterThan(0)

    const lastSettingsWrite = settingsWrites[settingsWrites.length - 1]
    const writtenSettings = JSON.parse(lastSettingsWrite[1] as string)
    expect(writtenSettings.migrations).toContain('mcp-tool-suffix-removal-v1')
  })

})

describe('isMigrationCompleted and markMigrationCompleted', () => {

  beforeEach(() => {
    vi.clearAllMocks()
    clearAppSettingsCache()
  })

  it('isMigrationCompleted returns false when no migrations array', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readFileSync).mockImplementation((path: any) => {
      if (path.includes('settings.json')) return JSON.stringify({})
      return ''
    })

    expect(isMigrationCompleted(mockApp)).toBe(false)
  })

  it('isMigrationCompleted returns false when migration not in array', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readFileSync).mockImplementation((path: any) => {
      if (path.includes('settings.json')) return JSON.stringify({
        migrations: ['some-other-migration']
      })
      return ''
    })

    expect(isMigrationCompleted(mockApp)).toBe(false)
  })

  it('isMigrationCompleted returns true when migration is in array', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readFileSync).mockImplementation((path: any) => {
      if (path.includes('settings.json')) return JSON.stringify({
        migrations: ['mcp-tool-suffix-removal-v1']
      })
      return ''
    })

    expect(isMigrationCompleted(mockApp)).toBe(true)
  })

  it('markMigrationCompleted adds migration to array', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readFileSync).mockImplementation((path: any) => {
      if (path.includes('settings.json')) return JSON.stringify({ general: {} })
      return ''
    })

    markMigrationCompleted(mockApp)

    const writeCall = vi.mocked(fs.writeFileSync).mock.calls.find(
      call => (call[0] as string).includes('settings.json')
    )
    expect(writeCall).toBeTruthy()
    const writtenData = JSON.parse(writeCall![1] as string)
    expect(writtenData.migrations).toContain('mcp-tool-suffix-removal-v1')
  })

})

describe('migrateSettingsMcpToolNames', () => {

  beforeEach(() => {
    vi.clearAllMocks()
    clearAppSettingsCache()
  })

  it('migrates llm.defaults[].tools with old suffixes', async () => {
    const settings = {
      llm: {
        defaults: [
          { engine: 'openai', model: 'gpt-4', tools: ['tool1___90ab', 'clean_tool', 'tool2___1234'] },
          { engine: 'anthropic', model: 'claude-3', tools: ['another___5678'] },
        ]
      }
    }

    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readFileSync).mockImplementation((path: any) => {
      if (path.includes('settings.json')) return JSON.stringify(settings)
      return ''
    })
    vi.mocked(fs.readdirSync).mockReturnValue([] as any)

    const count = await migrateMcpToolNames(mockApp)

    expect(count).toBe(3) // tool1, tool2, another

    const settingsWrite = vi.mocked(fs.writeFileSync).mock.calls.find(
      call => (call[0] as string).includes('settings.json')
    )
    expect(settingsWrite).toBeTruthy()

    const savedSettings = JSON.parse(settingsWrite![1] as string)
    expect(savedSettings.llm.defaults[0].tools).toEqual(['tool1', 'clean_tool', 'tool2'])
    expect(savedSettings.llm.defaults[1].tools).toEqual(['another'])
  })

  it('migrates prompt.tools (scratchpad) with old suffixes', async () => {
    const settings = {
      prompt: {
        engine: 'openai',
        model: 'gpt-4',
        tools: ['scratchpad_tool___abcd', 'clean_tool']
      }
    }

    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readFileSync).mockImplementation((path: any) => {
      if (path.includes('settings.json')) return JSON.stringify(settings)
      return ''
    })
    vi.mocked(fs.readdirSync).mockReturnValue([] as any)

    const count = await migrateMcpToolNames(mockApp)

    expect(count).toBe(1) // scratchpad_tool

    const settingsWrite = vi.mocked(fs.writeFileSync).mock.calls.find(
      call => (call[0] as string).includes('settings.json')
    )
    expect(settingsWrite).toBeTruthy()

    const savedSettings = JSON.parse(settingsWrite![1] as string)
    expect(savedSettings.prompt.tools).toEqual(['scratchpad_tool', 'clean_tool'])
  })

  it('migrates realtime.tools (voice mode) with old suffixes', async () => {
    const settings = {
      realtime: {
        engine: 'openai',
        tools: ['voice_tool___1111', 'voice_tool___2222', 'clean_voice_tool']
      }
    }

    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readFileSync).mockImplementation((path: any) => {
      if (path.includes('settings.json')) return JSON.stringify(settings)
      return ''
    })
    vi.mocked(fs.readdirSync).mockReturnValue([] as any)

    const count = await migrateMcpToolNames(mockApp)

    expect(count).toBe(2) // voice_tool x2

    const settingsWrite = vi.mocked(fs.writeFileSync).mock.calls.find(
      call => (call[0] as string).includes('settings.json')
    )
    expect(settingsWrite).toBeTruthy()

    const savedSettings = JSON.parse(settingsWrite![1] as string)
    expect(savedSettings.realtime.tools).toEqual(['voice_tool', 'voice_tool', 'clean_voice_tool'])
  })

  it('migrates all settings sections together', async () => {
    const settings = {
      llm: {
        defaults: [
          { engine: 'openai', model: 'gpt-4', tools: ['llm_tool___aaaa'] }
        ]
      },
      prompt: {
        tools: ['prompt_tool___bbbb']
      },
      realtime: {
        tools: ['realtime_tool___cccc']
      }
    }

    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readFileSync).mockImplementation((path: any) => {
      if (path.includes('settings.json')) return JSON.stringify(settings)
      return ''
    })
    vi.mocked(fs.readdirSync).mockReturnValue([] as any)

    const count = await migrateMcpToolNames(mockApp)

    expect(count).toBe(3) // One from each section

    const settingsWrite = vi.mocked(fs.writeFileSync).mock.calls.find(
      call => (call[0] as string).includes('settings.json')
    )
    const savedSettings = JSON.parse(settingsWrite![1] as string)
    expect(savedSettings.llm.defaults[0].tools).toEqual(['llm_tool'])
    expect(savedSettings.prompt.tools).toEqual(['prompt_tool'])
    expect(savedSettings.realtime.tools).toEqual(['realtime_tool'])
  })

  it('does not save settings if no tools need migration', async () => {
    const settings = {
      llm: {
        defaults: [
          { engine: 'openai', model: 'gpt-4', tools: ['clean_tool'] }
        ]
      },
      prompt: {
        tools: ['another_clean_tool']
      },
      realtime: {
        tools: ['voice_clean_tool']
      }
    }

    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readFileSync).mockImplementation((path: any) => {
      if (path.includes('settings.json')) return JSON.stringify(settings)
      return ''
    })
    vi.mocked(fs.readdirSync).mockReturnValue([] as any)

    const count = await migrateMcpToolNames(mockApp)

    expect(count).toBe(0)
  })

  it('handles missing settings sections gracefully', async () => {
    const settings = {
      general: { firstRun: false }
    }

    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readFileSync).mockImplementation((path: any) => {
      if (path.includes('settings.json')) return JSON.stringify(settings)
      return ''
    })
    vi.mocked(fs.readdirSync).mockReturnValue([] as any)

    const count = await migrateMcpToolNames(mockApp)

    expect(count).toBe(0)
  })

  it('handles empty tools arrays in settings', async () => {
    const settings = {
      llm: {
        defaults: [
          { engine: 'openai', model: 'gpt-4', tools: [] as string[] }
        ]
      },
      prompt: { tools: [] as string[] },
      realtime: { tools: [] as string[] }
    }

    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readFileSync).mockImplementation((path: any) => {
      if (path.includes('settings.json')) return JSON.stringify(settings)
      return ''
    })
    vi.mocked(fs.readdirSync).mockReturnValue([] as any)

    const count = await migrateMcpToolNames(mockApp)

    expect(count).toBe(0)
  })

})

describe('edge cases and real-world scenarios', () => {

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('handles tool names that look similar to suffix but are not', () => {
    const toolNames = [
      'tool___',        // No chars after ___
      'tool___a',       // 1 char
      'tool___ab',      // 2 chars
      'tool___abc',     // 3 chars
      'tool___abcde',   // 5 chars
      'tool__1234',     // 2 underscores
      'tool_1234',      // 1 underscore
      'tool1234',       // no underscores
    ]

    for (const tool of toolNames) {
      expect(hasOldToolSuffix(tool)).toBe(false)
      expect(stripOldToolSuffix(tool)).toBe(tool)
    }
  })

  it('correctly handles all valid 4-char suffixes', () => {
    const validSuffixes = ['0000', '9999', 'aaaa', 'zzzz', 'AAAA', 'ZZZZ', '12ab', 'Ab12', '!@#$', 'a1b2']

    for (const suffix of validSuffixes) {
      const toolName = `tool___${suffix}`
      expect(hasOldToolSuffix(toolName)).toBe(true)
      expect(stripOldToolSuffix(toolName)).toBe('tool')
    }
  })

  it('handles special characters in tool names', () => {
    expect(stripOldToolSuffix('my-tool___1234')).toBe('my-tool')
    expect(stripOldToolSuffix('my.tool___1234')).toBe('my.tool')
    expect(hasOldToolSuffix('my-tool___1234')).toBe(true)
  })

  it('idempotent - running migration twice has no additional effect', async () => {
    // First run: agent has old suffix
    const agentBefore = createAgentJson('agent-1', [['list_files___90ab']])

    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readdirSync).mockImplementation((path: any) => {
      if (path.includes('agents')) return ['agent-1.json'] as any
      return [] as any
    })
    vi.mocked(fs.readFileSync).mockImplementation((path: any) => {
      if (path.includes('agent-1')) return agentBefore
      if (path.includes('history.json')) return JSON.stringify({ version: 1, chats: [], folders: [] })
      return ''
    })
    vi.mocked(fs.statSync).mockReturnValue({ isFile: () => true, isDirectory: () => true } as any)

    const count1 = await migrateWorkspaceMcpToolNames(mockApp, 'workspace-1')
    expect(count1).toBe(1)

    // Second run: agent already migrated
    vi.clearAllMocks()
    const agentAfter = createAgentJson('agent-1', [['list_files']]) // No suffix
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readdirSync).mockImplementation((path: any) => {
      if (path.includes('agents')) return ['agent-1.json'] as any
      return [] as any
    })
    vi.mocked(fs.readFileSync).mockImplementation((path: any) => {
      if (path.includes('agent-1')) return agentAfter
      if (path.includes('history.json')) return JSON.stringify({ version: 1, chats: [], folders: [] })
      return ''
    })
    vi.mocked(fs.statSync).mockReturnValue({ isFile: () => true, isDirectory: () => true } as any)

    const count2 = await migrateWorkspaceMcpToolNames(mockApp, 'workspace-1')
    expect(count2).toBe(0)
    expect(fs.writeFileSync).not.toHaveBeenCalled()
  })

  it('handles realistic MCP tool names from various connectors', () => {
    const realToolNames = [
      'github_create_pull_request___a1b2',
      'slack_send_message___c3d4',
      'jira_create_issue___e5f6',
      'confluence_get_page___7890',
      'google_calendar_list_events___abcd',
      'mcp__github__create_branch___1234',
    ]

    for (const tool of realToolNames) {
      expect(hasOldToolSuffix(tool)).toBe(true)
      const stripped = stripOldToolSuffix(tool)
      expect(stripped).not.toContain('___')
      expect(stripped.length).toBe(tool.length - 7) // ___xxxx = 7 chars
    }
  })

  it('does not corrupt tool names that contain numbers', () => {
    const toolsWithNumbers = [
      'tool_v2',
      'tool_123',
      'tool_2024',
      'tool__v1',
      'tool___v1',  // Only 2 chars after ___
    ]

    for (const tool of toolsWithNumbers) {
      expect(hasOldToolSuffix(tool)).toBe(false)
      expect(stripOldToolSuffix(tool)).toBe(tool)
    }
  })

  it('new _N collision format is NOT migrated', () => {
    const newFormatTools = [
      'tool_1',
      'tool_2',
      'tool_10',
      'tool_99',
      'my_complex_tool_1',
    ]

    for (const tool of newFormatTools) {
      expect(hasOldToolSuffix(tool)).toBe(false)
      expect(stripOldToolSuffix(tool)).toBe(tool)
    }
  })

})

describe('normalizePromptToolNames', () => {

  it('returns prompt unchanged if no tools provided', () => {
    const prompt = 'Use the tool___1234 to do something'
    expect(normalizePromptToolNames(prompt, null)).toBe(prompt)
    expect(normalizePromptToolNames(prompt, undefined)).toBe(prompt)
    expect(normalizePromptToolNames(prompt, [])).toBe(prompt)
  })

  it('returns prompt unchanged if prompt is null or undefined', () => {
    expect(normalizePromptToolNames(null, ['tool'])).toBeNull()
    expect(normalizePromptToolNames(undefined, ['tool'])).toBeUndefined()
    expect(normalizePromptToolNames('', ['tool'])).toBe('')
  })

  it('replaces single tool with old suffix in prompt', () => {
    const prompt = 'Use the list_files___90ab tool to list files'
    const tools = ['list_files']
    expect(normalizePromptToolNames(prompt, tools)).toBe('Use the list_files tool to list files')
  })

  it('replaces multiple tools with old suffixes in prompt', () => {
    const prompt = 'First use list_files___90ab then use create_branch___1234 to create a branch'
    const tools = ['list_files', 'create_branch']
    expect(normalizePromptToolNames(prompt, tools)).toBe('First use list_files then use create_branch to create a branch')
  })

  it('handles multiple occurrences of the same tool', () => {
    const prompt = 'Call list_files___90ab first, then list_files___90ab again'
    const tools = ['list_files']
    expect(normalizePromptToolNames(prompt, tools)).toBe('Call list_files first, then list_files again')
  })

  it('handles tools that do not have old suffix in prompt', () => {
    const prompt = 'Use list_files for files'
    const tools = ['list_files']
    expect(normalizePromptToolNames(prompt, tools)).toBe('Use list_files for files')
  })

  it('only replaces tool names that match (word boundary)', () => {
    const prompt = 'Use list_files___90ab not my_list_files___90ab'
    const tools = ['list_files']
    expect(normalizePromptToolNames(prompt, tools)).toBe('Use list_files not my_list_files___90ab')
  })

  it('handles special regex characters in tool names', () => {
    const prompt = 'Use tool.name___90ab for processing'
    const tools = ['tool.name']
    expect(normalizePromptToolNames(prompt, tools)).toBe('Use tool.name for processing')
  })

  it('handles realistic agent prompt', () => {
    const prompt = `You are a helpful assistant.

Available tools:
- list_files___90ab: Lists files in a directory
- create_branch___1234: Creates a new git branch
- send_message___abcd: Sends a message

First, use list_files___90ab to see what files exist.
Then use create_branch___1234 to create a feature branch.
Finally, use send_message___abcd to notify the team.`

    const tools = ['list_files', 'create_branch', 'send_message']

    const expected = `You are a helpful assistant.

Available tools:
- list_files: Lists files in a directory
- create_branch: Creates a new git branch
- send_message: Sends a message

First, use list_files to see what files exist.
Then use create_branch to create a feature branch.
Finally, use send_message to notify the team.`

    expect(normalizePromptToolNames(prompt, tools)).toBe(expected)
  })

  it('handles MCP-style tool names', () => {
    const prompt = 'Use mcp__github__create_branch___1234 to create branch'
    const tools = ['mcp__github__create_branch']
    expect(normalizePromptToolNames(prompt, tools)).toBe('Use mcp__github__create_branch to create branch')
  })

})

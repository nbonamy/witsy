import { vi, beforeEach, expect, test, describe } from 'vitest'
import { useWindowMock } from '@tests/mocks/window'
import * as workspace from '@main/workspace'
import { kDefaultWorkspaceId } from '@/consts'
import { app } from 'electron'
import fs from 'fs'

// Mock electron
vi.mock('electron', async() => {
  return {
    app: {
      getPath: vi.fn(() => 'tests/fixtures')
    },
  }
})

// Mock fs - only mock write operations, let read operations work normally
vi.mock('fs', async (importOriginal) => {
  const mod: any = await importOriginal()
  return { 
    default: {
      ...mod,
      mkdirSync: vi.fn(),
      writeFileSync: vi.fn(),
      existsSync: vi.fn(),
      renameSync: vi.fn(),
    }
  }
})

beforeEach(() => {
  useWindowMock()
  vi.clearAllMocks()
})

describe('workspacesFolder', () => {
  test('should return correct workspaces folder path', () => {
    const result = workspace.workspacesFolder(app)
    
    expect(app.getPath).toHaveBeenCalledWith('userData')
    expect(fs.mkdirSync).toHaveBeenCalledWith('tests/fixtures/workspaces', { recursive: true })
    expect(result).toBe('tests/fixtures/workspaces')
  })
})

describe('listWorkspaces', () => {
  test('should return workspace headers from fixture files', () => {
    const result = workspace.listWorkspaces(app)
    
    expect(result).toHaveLength(3)
    expect(result).toContainEqual({
      uuid: 'workspace-1',
      name: 'Test Workspace 1',
      icon: '🚀',
      color: '#ff0000'
    })
    expect(result).toContainEqual({
      uuid: 'workspace-2',
      name: 'Test Workspace 2',
      icon: '📊',
      color: '#00ff00'
    })
    expect(result).toContainEqual({
      uuid: 'test-workspace',
      name: 'Test Workspace',
      icon: undefined,
      color: undefined
    })
  })

  test('should return empty array when workspaces folder does not exist', () => {
    // Temporarily mock getPath to return non-existent directory
    vi.mocked(app.getPath).mockReturnValueOnce('nonexistent')
    
    const result = workspace.listWorkspaces(app)
    
    expect(result).toEqual([])
  })
})

describe('loadWorkspace', () => {
  test('should load workspace successfully from fixture', () => {
    const result = workspace.loadWorkspace(app, 'workspace1')

    expect(result).not.toBeNull()
    expect(result?.uuid).toBe('workspace-1')
    expect(result?.name).toBe('Test Workspace 1')
    expect(result?.icon).toBe('🚀')
    expect(result?.color).toBe('#ff0000')
    expect(result?.models).toHaveLength(1)
    expect(result?.experts).toEqual(['expert1', 'expert2'])
    expect(result?.hiddenFeatures).toEqual(['studio', 'scratchpad'])
  })

  test('should default hiddenFeatures to empty array when not present', () => {
    const result = workspace.loadWorkspace(app, 'workspace2')

    expect(result).not.toBeNull()
    expect(result?.hiddenFeatures).toEqual([])
  })

  test('should return null when workspace file does not exist', () => {
    const result = workspace.loadWorkspace(app, 'nonexistent')

    expect(result).toBeNull()
  })

  test('should return null when workspace file has invalid structure', () => {
    const result = workspace.loadWorkspace(app, 'invalid-folder')

    expect(result).toBeNull()
  })
})

describe('saveWorkspace', () => {
  test('should save workspace successfully', () => {
    const workspaceData = {
      uuid: 'workspace-1',
      name: 'Test Workspace 1',
      icon: '🚀',
      color: '#ff0000',
      models: [],
      experts: [],
      docrepos: [],
      agents: [],
      hiddenFeatures: ['voiceMode']
    }

    const result = workspace.saveWorkspace(app, workspaceData)

    expect(result).toBe(true)

    // mkdirSync is called twice: once for workspaces folder, once for specific workspace folder
    expect(fs.mkdirSync).toHaveBeenCalledTimes(2)
    expect(fs.mkdirSync).toHaveBeenCalledWith('tests/fixtures/workspaces', { recursive: true })
    expect(fs.mkdirSync).toHaveBeenCalledWith('tests/fixtures/workspaces/workspace-1', { recursive: true })

    expect(fs.writeFileSync).toHaveBeenCalledWith(
      'tests/fixtures/workspaces/workspace-1/workspace.json',
      JSON.stringify(workspaceData, null, 2)
    )
  })

  test('should return false when save fails', () => {
    // Mock writeFileSync to throw error instead of mkdirSync to avoid interference with workspacesFolder call
    vi.mocked(fs.writeFileSync).mockImplementation(() => {
      throw new Error('Permission denied')
    })
    
    const workspaceData = {
      uuid: 'workspace-1',
      name: 'Test Workspace 1',
      icon: '🚀',
      color: '#ff0000',
      models: [],
      experts: [],
      docrepos: [],
      agents: []
    }
    
    const result = workspace.saveWorkspace(app, workspaceData)
    
    expect(result).toBe(false)
  })
})

describe('migrateExistingItemsToWorkspace', () => {
  let existingSources: string[] = []
  let existingDestinations: string[] = []
  let renamedItems: Array<{ from: string; to: string }> = []

  beforeEach(() => {
    existingSources = []
    existingDestinations = []
    renamedItems = []

    // Mock existsSync to return true for items in existingSources, false for existingDestinations
    vi.mocked(fs.existsSync).mockImplementation((path: fs.PathLike) => {
      const pathStr = path.toString()
      
      // Check if it's a workspace destination path that should exist
      if (existingDestinations.some(dest => pathStr.includes(`/workspaces/`) && pathStr.includes(dest))) {
        return true
      }
      
      // Check if it's a source path that should exist
      if (existingSources.some(src => !pathStr.includes(`/workspaces/`) && pathStr.includes(src))) {
        return true
      }
      
      // For workspace.json files, always return false for simplicity
      if (pathStr.includes('workspace.json')) {
        return false
      }
      
      // Default return false
      return false
    })

    // Mock renameSync to track moves
    vi.mocked(fs.renameSync).mockImplementation((oldPath: fs.PathLike, newPath: fs.PathLike) => {
      renamedItems.push({ from: oldPath.toString(), to: newPath.toString() })
    })
  })

  test('should migrate existing folders and files to workspace', () => {
    const workspaceId = kDefaultWorkspaceId
    
    // Set up existing sources (in userData)
    existingSources = [ 'agents', 'images', 'history.json' ]
    existingDestinations = [] // No existing destinations
    
    const result = workspace.migrateExistingItemsToWorkspace(app, workspaceId)
    
    expect(result).toBe(true)
    expect(renamedItems).toHaveLength(existingSources.length)
    
    // Check that all expected items were renamed/moved
    const expectedMoves = [
      'agents', 'images', 'history.json'
    ]
    
    expectedMoves.forEach(item => {
      const move = renamedItems.find(r => r.from.includes(item) && r.to.includes(item))
      expect(move).toBeDefined()
      expect(move?.from).toBe(`tests/fixtures/${item}`)
      expect(move?.to).toBe(`tests/fixtures/workspaces/${workspaceId}/${item}`)
    })
  })

  test('should not migrate if items already exist in workspace', () => {
    const workspaceId = kDefaultWorkspaceId
    
    // Set up existing sources and destinations (conflict scenario)
    existingSources = ['agents', 'commands.json']
    existingDestinations = ['agents', 'commands.json'] // Already exist in destination
    
    const result = workspace.migrateExistingItemsToWorkspace(app, workspaceId)
    
    expect(result).toBe(false)
    expect(renamedItems).toHaveLength(0) // No items should be moved
  })

  test('should return false when no items to migrate', () => {
    const workspaceId = kDefaultWorkspaceId
    
    // Set up no existing sources
    existingSources = []
    existingDestinations = []
    
    const result = workspace.migrateExistingItemsToWorkspace(app, workspaceId)
    
    expect(result).toBe(false)
    expect(renamedItems).toHaveLength(0)
  })

  test('should migrate partial items successfully', () => {
    const workspaceId = kDefaultWorkspaceId
    
    // Set up only some existing sources
    existingSources = ['agents', 'commands.json']
    existingDestinations = []
    
    const result = workspace.migrateExistingItemsToWorkspace(app, workspaceId)
    
    expect(result).toBe(true)
    expect(renamedItems).toHaveLength(1)
    
    // Check specific moves
    const agentMove = renamedItems.find(r => r.from.includes('agents'))
    const commandMove = renamedItems.find(r => r.from.includes('commands.json'))
    
    expect(agentMove).toBeDefined()
    expect(commandMove).toBeUndefined()
    expect(agentMove?.from).toBe('tests/fixtures/agents')
  })

  test('should continue migration even if some items fail', () => {
    const workspaceId = kDefaultWorkspaceId

    // Set up existing sources
    existingSources = ['agents', 'commands.json', 'experts.json']
    existingDestinations = []

    // Mock renameSync to fail for one item
    vi.mocked(fs.renameSync).mockImplementation((oldPath: fs.PathLike, newPath: fs.PathLike) => {
      if (oldPath.toString().includes('commands.json')) {
        throw new Error('Permission denied')
      }
      renamedItems.push({ from: oldPath.toString(), to: newPath.toString() })
    })

    const result = workspace.migrateExistingItemsToWorkspace(app, workspaceId)

    expect(result).toBe(true)
    expect(renamedItems).toHaveLength(1)

    const agentMove = renamedItems.find(r => r.from.includes('agents'))
    expect(agentMove).toBeDefined()

    const expertsMove = renamedItems.find(r => r.from.includes('experts.json'))
    expect(expertsMove).toBeUndefined()

  })
})

describe('migrateHistoryImagePaths', () => {

  test('should migrate Windows-style paths with backslashes', () => {
    const darwinInput = `
      "content": "[Title](file:///Users/username/Library/Application Support/Witsy/images/image-id.png)",
      "url": "file:///Users/username/Library/Application Support/Witsy/images/image-id.png"
    `
    const darwinOutput = `
      "content": "[Title](file:///Users/username/Library/Application Support/Witsy/workspaces/0000-0000/images/image-id.png)",
      "url": "file:///Users/username/Library/Application Support/Witsy/workspaces/0000-0000/images/image-id.png"
    `

    const win32Input = `
      "content": "[Title](file://C:\\\\Users\\\\username\\\\AppData\\\\Roaming\\\\Witsy\\\\images\\\\image-id.png)",
      "url": "file://C:\\Users\\username\\AppData\\Roaming\\Witsy\\images\\image-id.png"
    `

    const win32Output = `
      "content": "[Title](file://C:\\\\Users\\\\username\\\\AppData\\\\Roaming\\\\Witsy\\\\workspaces\\\\0000-0000\\\\images\\\\image-id.png)",
      "url": "file://C:\\Users\\username\\AppData\\Roaming\\Witsy\\workspaces\\0000-0000\\images\\image-id.png"
    `

    expect(workspace.migrateHistoryImagePaths(darwinInput, '0000-0000', 'darwin')).toBe(darwinOutput)
    expect(workspace.migrateHistoryImagePaths(win32Input, '0000-0000', 'win32')).toBe(win32Output)

    if (process.platform === 'win32') {
      expect(workspace.migrateHistoryImagePaths(darwinInput, '0000-0000')).toBe(darwinInput)
      expect(workspace.migrateHistoryImagePaths(win32Input, '0000-0000')).toBe(win32Output)
    } else {
      expect(workspace.migrateHistoryImagePaths(darwinInput, '0000-0000')).toBe(darwinOutput)
      expect(workspace.migrateHistoryImagePaths(win32Input, '0000-0000')).toBe(win32Input)
    }

  })

})

import { vi, beforeEach, expect, test } from 'vitest'
import { useWindowMock } from '@tests/mocks/window'
import { store } from '@services/store'
import FilesystemPlugin from '@services/plugins/filesystem'
import { PluginExecutionContext } from 'multi-llm-ts'
import Dialog from '@renderer/utils/dialog'

global.atob = (str: string) => str

const context: PluginExecutionContext = {
  model: 'mock',
}

const workspaceId = 'workspace1'

beforeEach(() => {

  vi.clearAllMocks()
  useWindowMock()

  window.api.file.exists = vi.fn((path: string) => {
    return path.startsWith('/home/user/Documents/test')
  })

  store.config = {
    plugins: {
      filesystem: {
        enabled: true,
        allowedPaths: ['/tmp', '~/Documents'],
        allowWrite: false,
        skipConfirmation: false,
      }
    }
  } as any
})

test('Filesystem plugin initialization', () => {
  const plugin = new FilesystemPlugin(store.config.plugins.filesystem, workspaceId)
  expect(plugin.getName()).toBe('filesystem')
  expect(plugin.isEnabled()).toBe(true)
})

test('Filesystem plugin parameters', () => {
  const plugin = new FilesystemPlugin(store.config.plugins.filesystem, workspaceId)
  const params = plugin.getParameters()
  expect(params).toHaveLength(6)
  expect(params[0].name).toBe('action')
  expect(params[0].enum).toEqual(['list', 'read', 'write', 'find'])
  expect(params[1].name).toBe('path')
  expect(params[2].name).toBe('content')
  expect(params[3].name).toBe('pattern')
  expect(params[4].name).toBe('maxResults')
  expect(params[5].name).toBe('includeHidden')
})

test('Filesystem plugin parameters with write rights', () => {
  store.config.plugins.filesystem.allowWrite = true
  const plugin = new FilesystemPlugin(store.config.plugins.filesystem, workspaceId)
  const params = plugin.getParameters()
  expect(params).toHaveLength(6)
  expect(params[0].name).toBe('action')
  expect(params[0].enum).toEqual(['list', 'read', 'write', 'find', 'delete'])
  expect(params[1].name).toBe('path')
  expect(params[2].name).toBe('content')
  expect(params[3].name).toBe('pattern')
  expect(params[4].name).toBe('maxResults')
  expect(params[5].name).toBe('includeHidden')
})

test('Filesystem plugin map path to allowed paths', () => {
  const plugin = new FilesystemPlugin(store.config.plugins.filesystem, workspaceId)
  expect(plugin.mapToAllowedPaths('/tmp/test')).toBe('/tmp/test')
  expect(plugin.mapToAllowedPaths('Documents')).toBe('/home/user/Documents')
  expect(plugin.mapToAllowedPaths('~/Documents/test')).toBe('/home/user/Documents/test')
  expect(plugin.mapToAllowedPaths('./Documents/test')).toBe('/home/user/Documents/test')
  expect(plugin.mapToAllowedPaths('Documents/test/subdir')).toBe('/home/user/Documents/test/subdir')
})

test('Filesystem plugin map path - subdirectory resolution', () => {
  // Test the subdirectory resolution path where allowed path + ./ + target exists
  window.api.file.exists = vi.fn((path: string) => {
    return path === '/home/user/Documents/./subdir/file.txt'
  })
  const plugin = new FilesystemPlugin(store.config.plugins.filesystem, workspaceId)
  const result = plugin.mapToAllowedPaths('subdir/file.txt')
  expect(result).toBe('/home/user/Documents/./subdir/file.txt')
})

test('Filesystem plugin path validation', async () => {
  const plugin = new FilesystemPlugin(store.config.plugins.filesystem, workspaceId)
  const allowedResult = await plugin.execute(context, {
    action: 'list',
    path: '/tmp/test'
  })
  expect(allowedResult.error).toBeUndefined()
  const disallowedResult = await plugin.execute(context, {
    action: 'list',
    path: '/etc/passwd'
  })
  expect(disallowedResult.error).toContain('plugins.filesystem.invalidPath')
})

test('Filesystem plugin list directory', async () => {
  const plugin = new FilesystemPlugin(store.config.plugins.filesystem, workspaceId)
  const result = await plugin.execute(context, {
    action: 'list',
    path: '/tmp/test'
  })
  expect(window.api.file.listDirectory).toHaveBeenCalledWith('/tmp/test', false)
  expect(result.items).toEqual([
    { name: 'file1.txt', fullPath: '/home/user/file1.txt', isDirectory: false, size: 100 },
    { name: 'subdir', fullPath: '/home/user/subdir', isDirectory: true }
  ])
})

test('Filesystem plugin list directory with hidden files', async () => {
  const plugin = new FilesystemPlugin(store.config.plugins.filesystem, workspaceId)
  await plugin.execute(context, {
    action: 'list',
    path: '/tmp/test',
    includeHidden: true
  })
  expect(window.api.file.listDirectory).toHaveBeenCalledWith('/tmp/test', true)
})

test('Filesystem plugin read file', async () => {
  const plugin = new FilesystemPlugin(store.config.plugins.filesystem, workspaceId)
  const result = await plugin.execute(context, {
    action: 'read',
    path: '/tmp/test.txt'
  })
  expect(window.api.file.read).toHaveBeenCalledWith('/tmp/test.txt')
  expect(window.api.file.extractText).toHaveBeenCalledWith('/tmp/test.txt_encoded', 'txt')
  expect(result.contents).toBe('/tmp/test.txt_encoded_extracted')
})

test('Filesystem plugin write file - new file', async () => {
  const plugin = new FilesystemPlugin(store.config.plugins.filesystem, workspaceId)
  const result = await plugin.execute(context, {
    action: 'write',
    path: '/tmp/newfile.txt',
    content: 'test content'
  })
  expect(window.api.file.exists).toHaveBeenCalledWith('/tmp/newfile.txt')
  expect(window.api.file.write).toHaveBeenCalledWith('/tmp/newfile.txt', 'test content')
  expect(result.success).toBe(true)
})

test('Filesystem plugin write file - overwrite disallowed', async () => {
  const plugin = new FilesystemPlugin(store.config.plugins.filesystem, workspaceId)
  const result = await plugin.execute(context, {
    action: 'write',
    path: '/home/user/Documents/test',
    content: 'test content'
  })
  expect(result.error).toContain('File already exists')
  expect(window.api.file.write).not.toHaveBeenCalled()
})

test('Filesystem plugin write file - overwrite allowed', async () => {
  store.config.plugins.filesystem.allowWrite = true
  const plugin = new FilesystemPlugin(store.config.plugins.filesystem, workspaceId)
  const result = await plugin.execute(context, {
    action: 'write',
    path: '/home/user/Documents/test',
    content: 'test content'
  })
  expect(result.success).toBe(true)
  expect(Dialog.show).toHaveBeenCalled()
  expect(window.api.file.write).toHaveBeenCalled()
})

test('Filesystem plugin write file - overwrite allowed and skipped', async () => {
  store.config.plugins.filesystem.allowWrite = true
  store.config.plugins.filesystem.skipConfirmation = true
  const plugin = new FilesystemPlugin(store.config.plugins.filesystem, workspaceId)
  const result = await plugin.execute(context, {
    action: 'write',
    path: '/home/user/Documents/test',
    content: 'test content'
  })
  expect(result.success).toBe(true)
  expect(Dialog.show).not.toHaveBeenCalled()
  expect(window.api.file.write).toHaveBeenCalled()
})

test('Filesystem plugin delete file - disallowed', async () => {
  const plugin = new FilesystemPlugin(store.config.plugins.filesystem, workspaceId)
  const result = await plugin.execute(context, {
    action: 'delete',
    path: '/home/user/Documents/test'
  })
  expect(result.error).toContain('Deletion is not allowed')
  expect(window.api.file.delete).not.toHaveBeenCalled()
})

test('Filesystem plugin delete file - allowed', async () => {
  store.config.plugins.filesystem.allowWrite = true
  const plugin = new FilesystemPlugin(store.config.plugins.filesystem, workspaceId)
  const result = await plugin.execute(context, {
    action: 'delete',
    path: '/home/user/Documents/test'
  })
  expect(result.success).toBe(true)
  expect(Dialog.show).toHaveBeenCalled()
  expect(window.api.file.delete).toHaveBeenCalled()
})

test('Filesystem plugin delete file - allowed and skipped', async () => {
  store.config.plugins.filesystem.allowWrite = true
  store.config.plugins.filesystem.skipConfirmation = true
  const plugin = new FilesystemPlugin(store.config.plugins.filesystem, workspaceId)
  const result = await plugin.execute(context, {
    action: 'delete',
    path: '/home/user/Documents/test'
  })
  expect(result.success).toBe(true)
  expect(Dialog.show).not.toHaveBeenCalled()
  expect(window.api.file.delete).toHaveBeenCalled()
})

test('Filesystem plugin disabled', () => {
  const disabledConfig = { enabled: false, allowedPaths: [], allowWrite: false, skipConfirmation: false }
  const plugin = new FilesystemPlugin(disabledConfig, workspaceId)
  expect(plugin.isEnabled()).toBe(false)
})

test('Filesystem plugin no allowed paths', () => {
  const noPathsConfig = { enabled: true, allowedPaths: [], allowWrite: false, skipConfirmation: false }
  const plugin = new FilesystemPlugin(noPathsConfig, workspaceId)
  expect(plugin.isEnabled()).toBe(false)
})

test('Filesystem plugin status descriptions', () => {
  const plugin = new FilesystemPlugin(store.config.plugins.filesystem, workspaceId)
  expect(plugin.getPreparationDescription()).toBe('plugins.filesystem.starting')
  expect(plugin.getRunningDescription('filesystem', { action: 'list', path: '/tmp' })).toBe('plugins.filesystem.list.running')
  expect(plugin.getRunningDescription('filesystem', { action: 'read', path: '/tmp/file.txt' })).toBe('plugins.filesystem.read.running')
  expect(plugin.getRunningDescription('filesystem', { action: 'write', path: '/tmp/file.txt' })).toBe('plugins.filesystem.write.running')
  expect(plugin.getRunningDescription('filesystem', { action: 'delete', path: '/tmp/file.txt' })).toBe('plugins.filesystem.delete.running')
  expect(plugin.getRunningDescription('filesystem', { action: 'find', path: '/tmp', pattern: '*.txt' })).toBe('plugins.filesystem.find.running')
  expect(plugin.getCompletedDescription('filesystem', { action: 'list', path: '/tmp' }, { success: true, items: [1, 2] })).toBe('plugins.filesystem.list.completed')
  expect(plugin.getCompletedDescription('filesystem', { action: 'read', path: '/tmp/file.txt' }, { success: true, contents: 'test' })).toBe('plugins.filesystem.read.completed')
  expect(plugin.getCompletedDescription('filesystem', { action: 'write', path: '/tmp/file.txt' }, { success: true })).toBe('plugins.filesystem.write.completed')
  expect(plugin.getCompletedDescription('filesystem', { action: 'delete', path: '/tmp/file.txt' }, { success: true })).toBe('plugins.filesystem.delete.completed')
  expect(plugin.getCompletedDescription('filesystem', { action: 'find', path: '/tmp', pattern: '*.txt' }, { success: true, count: 3 })).toBe('plugins.filesystem.find.completed')
  expect(plugin.getCompletedDescription('filesystem', { action: 'list', path: '/tmp' }, { success: false, error: 'test error' })).toBe('plugins.filesystem.list.error')
  expect(plugin.getCompletedDescription('filesystem', { action: 'read', path: '/tmp/file.txt' }, { success: false, error: 'test error' })).toBe('plugins.filesystem.read.error')
  expect(plugin.getCompletedDescription('filesystem', { action: 'write', path: '/tmp/file.txt' }, { success: false, error: 'test error' })).toBe('plugins.filesystem.write.error')
  expect(plugin.getCompletedDescription('filesystem', { action: 'delete', path: '/tmp/file.txt' }, { success: false, error: 'test error' })).toBe('plugins.filesystem.delete.error')
  expect(plugin.getCompletedDescription('filesystem', { action: 'find', path: '/tmp', pattern: '*.txt' }, { success: false, error: 'test error' })).toBe('plugins.filesystem.find.error')
})

test('Filesystem plugin unknown action', async () => {
  const plugin = new FilesystemPlugin(store.config.plugins.filesystem, workspaceId)
  const result = await plugin.execute(context, {
    action: 'unknown_action' as any,
    path: '/tmp/test'
  })
  expect(result.error).toContain('Unknown action')
})

test('Filesystem plugin list directory - error handling', async () => {
  window.api.file.listDirectory = vi.fn(() => {
    throw new Error('Directory not found')
  })
  const plugin = new FilesystemPlugin(store.config.plugins.filesystem, workspaceId)
  const result = await plugin.execute(context, {
    action: 'list',
    path: '/tmp/test'
  })
  expect(result.success).toBe(false)
  expect(result.error).toContain('plugins.filesystem.list.error')
})

test('Filesystem plugin read file - error handling', async () => {
  window.api.file.read = vi.fn(() => {
    throw new Error('File not found')
  })
  const plugin = new FilesystemPlugin(store.config.plugins.filesystem, workspaceId)
  const result = await plugin.execute(context, {
    action: 'read',
    path: '/tmp/test.txt'
  })
  expect(result.success).toBe(false)
  expect(result.error).toContain('plugins.filesystem.read.error')
})

test('Filesystem plugin write file - error handling', async () => {
  store.config.plugins.filesystem.allowWrite = true
  store.config.plugins.filesystem.skipConfirmation = true
  window.api.file.write = vi.fn(() => {
    throw new Error('Write failed')
  })
  const plugin = new FilesystemPlugin(store.config.plugins.filesystem, workspaceId)
  const result = await plugin.execute(context, {
    action: 'write',
    path: '/tmp/test.txt',
    content: 'test'
  })
  expect(result.success).toBe(false)
  expect(result.error).toContain('plugins.filesystem.write.error')
})

test('Filesystem plugin write file - user declines confirmation', async () => {
  store.config.plugins.filesystem.allowWrite = true
  store.config.plugins.filesystem.skipConfirmation = false
  vi.mocked(Dialog.show).mockResolvedValue({ isConfirmed: false } as any)
  const plugin = new FilesystemPlugin(store.config.plugins.filesystem, workspaceId)
  const result = await plugin.execute(context, {
    action: 'write',
    path: '/home/user/Documents/test',
    content: 'test'
  })
  expect(result.success).toBe(false)
  expect(result.error).toContain('plugins.filesystem.write.declined')
  expect(window.api.file.write).not.toHaveBeenCalled()
})

test('Filesystem plugin delete file - user declines confirmation', async () => {
  store.config.plugins.filesystem.allowWrite = true
  store.config.plugins.filesystem.skipConfirmation = false
  vi.mocked(Dialog.show).mockResolvedValue({ isConfirmed: false } as any)
  const plugin = new FilesystemPlugin(store.config.plugins.filesystem, workspaceId)
  const result = await plugin.execute(context, {
    action: 'delete',
    path: '/home/user/Documents/test'
  })
  expect(result.success).toBe(false)
  expect(result.error).toContain('plugins.filesystem.delete.declined')
  expect(window.api.file.delete).not.toHaveBeenCalled()
})

test('Filesystem plugin delete file - error handling', async () => {
  store.config.plugins.filesystem.allowWrite = true
  store.config.plugins.filesystem.skipConfirmation = true
  window.api.file.delete = vi.fn(() => {
    throw new Error('Delete failed')
  })
  const plugin = new FilesystemPlugin(store.config.plugins.filesystem, workspaceId)
  const result = await plugin.execute(context, {
    action: 'delete',
    path: '/home/user/Documents/test'
  })
  expect(result.success).toBe(false)
  expect(result.error).toContain('plugins.filesystem.delete.error')
})

test('Filesystem plugin delete file - delete returns false', async () => {
  store.config.plugins.filesystem.allowWrite = true
  store.config.plugins.filesystem.skipConfirmation = true
  window.api.file.delete = vi.fn(() => false)
  const plugin = new FilesystemPlugin(store.config.plugins.filesystem, workspaceId)
  const result = await plugin.execute(context, {
    action: 'delete',
    path: '/home/user/Documents/test'
  })
  expect(result.success).toBe(false)
  expect(result.error).toContain('plugins.filesystem.delete.error')
})

test('Filesystem plugin write file - write returns false', async () => {
  store.config.plugins.filesystem.allowWrite = true
  store.config.plugins.filesystem.skipConfirmation = true
  window.api.file.write = vi.fn(() => false)
  const plugin = new FilesystemPlugin(store.config.plugins.filesystem, workspaceId)
  const result = await plugin.execute(context, {
    action: 'write',
    path: '/tmp/test.txt',
    content: 'test'
  })
  expect(result.success).toBe(false)
  expect(result.error).toContain('plugins.filesystem.write.error')
})

test('Filesystem plugin find files', async () => {
  const plugin = new FilesystemPlugin(store.config.plugins.filesystem, workspaceId)
  const result = await plugin.execute(context, {
    action: 'find',
    path: '/tmp',
    pattern: '*.txt'
  })
  expect(window.api.file.findFiles).toHaveBeenCalledWith('/tmp', '*.txt', 10)
  expect(result.success).toBe(true)
  expect(result.files).toEqual(['/home/user/file1.txt', '/home/user/subdir/file2.txt'])
  expect(result.count).toBe(2)
  expect(result.truncated).toBe(false)
})

test('Filesystem plugin find files with maxResults', async () => {
  const plugin = new FilesystemPlugin(store.config.plugins.filesystem, workspaceId)
  const result = await plugin.execute(context, {
    action: 'find',
    path: '/tmp',
    pattern: '*.txt',
    maxResults: 1
  })
  expect(window.api.file.findFiles).toHaveBeenCalledWith('/tmp', '*.txt', 1)
  expect(result.success).toBe(true)
  expect(result.files).toEqual(['/home/user/file1.txt'])
  expect(result.count).toBe(1)
  expect(result.truncated).toBe(true)
})

test('Filesystem plugin find files - no pattern', async () => {
  const plugin = new FilesystemPlugin(store.config.plugins.filesystem, workspaceId)
  const result = await plugin.execute(context, {
    action: 'find',
    path: '/tmp'
  })
  expect(result.success).toBe(false)
  expect(result.error).toContain('plugins.filesystem.find.noPattern')
})

test('Filesystem plugin find files - error handling', async () => {
  window.api.file.findFiles = vi.fn(() => {
    throw new Error('Search failed')
  })
  const plugin = new FilesystemPlugin(store.config.plugins.filesystem, workspaceId)
  const result = await plugin.execute(context, {
    action: 'find',
    path: '/tmp',
    pattern: '*.txt'
  })
  expect(result.success).toBe(false)
  expect(result.error).toContain('plugins.filesystem.find.error')
})

test('Filesystem plugin find files - invalid path', async () => {
  const plugin = new FilesystemPlugin(store.config.plugins.filesystem, workspaceId)
  const result = await plugin.execute(context, {
    action: 'find',
    path: '/etc',
    pattern: '*.conf'
  })
  expect(result.error).toContain('plugins.filesystem.invalidPath')
})

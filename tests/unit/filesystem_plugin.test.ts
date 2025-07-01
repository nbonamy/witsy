import { beforeEach, expect, test } from 'vitest'
import { useWindowMock } from '../mocks/window'
import { store } from '../../src/services/store'
import FilesystemPlugin from '../../src/plugins/filesystem'
import { PluginExecutionContext } from 'multi-llm-ts'

global.atob = (str: string) => str

const context: PluginExecutionContext = {
  model: 'mock',
}

beforeEach(() => {
  useWindowMock()
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
  const plugin = new FilesystemPlugin(store.config.plugins.filesystem)
  expect(plugin.getName()).toBe('Filesystem Access')
  expect(plugin.isEnabled()).toBe(true)
})

test('Filesystem plugin tools', async () => {
  const plugin = new FilesystemPlugin(store.config.plugins.filesystem)
  const tools = await plugin.getTools()
  expect(tools).toHaveLength(3)
  expect(tools[0].function.name).toBe('filesystem_list')
  expect(tools[1].function.name).toBe('filesystem_read')
  expect(tools[2].function.name).toBe('filesystem_write')
})

test('Filesystem plugin tools with write rights', async () => {
  store.config.plugins.filesystem.allowWrite = true
  const plugin = new FilesystemPlugin(store.config.plugins.filesystem)
  const tools = await plugin.getTools()
  expect(tools).toHaveLength(4)
  expect(tools[0].function.name).toBe('filesystem_list')
  expect(tools[1].function.name).toBe('filesystem_read')
  expect(tools[2].function.name).toBe('filesystem_write')
  expect(tools[3].function.name).toBe('filesystem_delete')
})

test('Filesystem plugin handles tools correctly', async () => {
  const plugin = new FilesystemPlugin(store.config.plugins.filesystem)
  expect(plugin.handlesTool('filesystem_list')).toBe(true)
  expect(plugin.handlesTool('filesystem_read')).toBe(true)
  expect(plugin.handlesTool('filesystem_write')).toBe(true)
  expect(plugin.handlesTool('filesystem_delete')).toBe(false)
  expect(plugin.handlesTool('unknown_tool')).toBe(false)
})

test('Filesystem plugin handles tools correctly - write allowed', async () => {
  store.config.plugins.filesystem.allowWrite = true
  const plugin = new FilesystemPlugin(store.config.plugins.filesystem)
  expect(plugin.handlesTool('filesystem_list')).toBe(true)
  expect(plugin.handlesTool('filesystem_read')).toBe(true)
  expect(plugin.handlesTool('filesystem_write')).toBe(true)
  expect(plugin.handlesTool('filesystem_delete')).toBe(true)
  expect(plugin.handlesTool('unknown_tool')).toBe(false)
})

test('Filesystem plugin path validation', async () => {
  const plugin = new FilesystemPlugin(store.config.plugins.filesystem)
  const allowedResult = await plugin.execute(context, {
    tool: 'filesystem_list',
    parameters: { path: '/tmp/test' }
  })
  expect(allowedResult.error).toBeUndefined()
  const disallowedResult = await plugin.execute(context, {
    tool: 'filesystem_list',
    parameters: { path: '/etc/passwd' }
  })
  expect(disallowedResult.error).toContain('plugins.filesystem.invalidPath')
})

test('Filesystem plugin list directory', async () => {
  const plugin = new FilesystemPlugin(store.config.plugins.filesystem)
  const result = await plugin.execute(context, {
    tool: 'filesystem_list',
    parameters: { path: '/tmp/test' }
  })
  expect(window.api.file.listDirectory).toHaveBeenCalledWith('/tmp/test', false)
  expect(result.items).toEqual([
    { name: 'file1.txt', isDirectory: false, size: 100 },
    { name: 'subdir', isDirectory: true }
  ])
})

test('Filesystem plugin list directory with hidden files', async () => {
  const plugin = new FilesystemPlugin(store.config.plugins.filesystem)
  await plugin.execute(context, {
    tool: 'filesystem_list',
    parameters: { path: '/tmp/test', includeHidden: true }
  })
  expect(window.api.file.listDirectory).toHaveBeenCalledWith('/tmp/test', true)
})

test('Filesystem plugin read file', async () => {
  const plugin = new FilesystemPlugin(store.config.plugins.filesystem)
  const result = await plugin.execute(context, {
    tool: 'filesystem_read',
    parameters: { path: '/tmp/test.txt' }
  })
  expect(window.api.file.read).toHaveBeenCalledWith('/tmp/test.txt')
  expect(result.contents).toBe('/tmp/test.txt_encoded') 
})

test('Filesystem plugin write file - new file', async () => {
  const plugin = new FilesystemPlugin(store.config.plugins.filesystem)
    const result = await plugin.execute(context, {
    tool: 'filesystem_write',
    parameters: { path: '/tmp/newfile.txt', content: 'test content' }
  })
  expect(window.api.file.exists).toHaveBeenCalledWith('/tmp/newfile.txt')
  expect(window.api.file.write).toHaveBeenCalledWith('/tmp/newfile.txt', 'test content')
  expect(result.success).toBe(true)
})

test('Filesystem plugin write file - overwrite disallowed', async () => {
  const plugin = new FilesystemPlugin(store.config.plugins.filesystem)
  const result = await plugin.execute(context, {
    tool: 'filesystem_write',
    parameters: { path: '/tmp/existing.txt', content: 'test content' }
  })
  expect(result.error).toContain('File already exists')
  expect(window.api.file.write).not.toHaveBeenCalled()
})

test('Filesystem plugin write file - overwrite allowed', async () => {
  store.config.plugins.filesystem.allowWrite = true
  const plugin = new FilesystemPlugin(store.config.plugins.filesystem)
  const result = await plugin.execute(context, {
    tool: 'filesystem_write',
    parameters: { path: '/tmp/existing.txt', content: 'test content' }
  })
  expect(result.success).toBe(true)
  expect(window.api.showDialog).toHaveBeenCalled()
  expect(window.api.file.write).toHaveBeenCalled()
})

test('Filesystem plugin write file - overwrite allowed and skipped', async () => {
  store.config.plugins.filesystem.allowWrite = true
  store.config.plugins.filesystem.skipConfirmation = true
  const plugin = new FilesystemPlugin(store.config.plugins.filesystem)
  const result = await plugin.execute(context, {
    tool: 'filesystem_write',
    parameters: { path: '/tmp/existing.txt', content: 'test content' }
  })
  expect(result.success).toBe(true)
  expect(window.api.showDialog).not.toHaveBeenCalled()
  expect(window.api.file.write).toHaveBeenCalled()
})

test('Filesystem plugin delete file - disallowed', async () => {
  const plugin = new FilesystemPlugin(store.config.plugins.filesystem)
  const result = await plugin.execute(context, {
    tool: 'filesystem_delete',
    parameters: { path: '/tmp/existing.txt', content: 'test content' }
  })
  expect(result.error).toContain('not handled')
  expect(window.api.file.delete).not.toHaveBeenCalled()
})

test('Filesystem plugin delete file - allowed', async () => {
  store.config.plugins.filesystem.allowWrite = true
  const plugin = new FilesystemPlugin(store.config.plugins.filesystem)
  const result = await plugin.execute(context, {
    tool: 'filesystem_delete',
    parameters: { path: '/tmp/existing.txt', content: 'test content' }
  })
  expect(result.success).toBe(true)
  expect(window.api.showDialog).toHaveBeenCalled()
  expect(window.api.file.delete).toHaveBeenCalled()
})

test('Filesystem plugin delete file - allowed and skipped', async () => {
  store.config.plugins.filesystem.allowWrite = true
  store.config.plugins.filesystem.skipConfirmation = true
  const plugin = new FilesystemPlugin(store.config.plugins.filesystem)
  const result = await plugin.execute(context, {
    tool: 'filesystem_delete',
    parameters: { path: '/tmp/existing.txt', content: 'test content' }
  })
  expect(result.success).toBe(true)
  expect(window.api.showDialog).not.toHaveBeenCalled()
  expect(window.api.file.delete).toHaveBeenCalled()
})

test('Filesystem plugin disabled', () => {
  const disabledConfig = { enabled: false, allowedPaths: [], allowWrite: false, skipConfirmation: false }
  const plugin = new FilesystemPlugin(disabledConfig)
  expect(plugin.isEnabled()).toBe(false)
})

test('Filesystem plugin no allowed paths', () => {
  const noPathsConfig = { enabled: true, allowedPaths: [], allowWrite: false, skipConfirmation: false }
  const plugin = new FilesystemPlugin(noPathsConfig)
  expect(plugin.isEnabled()).toBe(false)
})

test('Filesystem plugin status descriptions', () => {
  const plugin = new FilesystemPlugin(store.config.plugins.filesystem)
  expect(plugin.getPreparationDescription('filesystem_list')).toBe('plugins.filesystem.list.starting')
  expect(plugin.getPreparationDescription('filesystem_read')).toBe('plugins.filesystem.read.starting')
  expect(plugin.getPreparationDescription('filesystem_write')).toBe('plugins.filesystem.write.starting')
  expect(plugin.getRunningDescription('filesystem_list', { path: '/tmp' })).toBe('plugins.filesystem.list.running')
  expect(plugin.getRunningDescription('filesystem_read', { path: '/tmp/file.txt' })).toBe('plugins.filesystem.read.running')
  expect(plugin.getCompletedDescription('filesystem_list', { path: '/tmp' }, { success: true, items: [1, 2] })).toBe('plugins.filesystem.list.completed')
  expect(plugin.getCompletedDescription('filesystem_read', { path: '/tmp/file.txt' }, { success: true, contents: 'test' })).toBe('plugins.filesystem.read.completed')
  expect(plugin.getCompletedDescription('filesystem_write', { path: '/tmp/file.txt' }, { success: true })).toBe('plugins.filesystem.write.completed')
  expect(plugin.getCompletedDescription('filesystem_list', {}, { success: false, error: 'test error' })).toBe('plugins.filesystem.list.error')
  expect(plugin.getCompletedDescription('filesystem_read', {}, { success: false, error: 'test error' })).toBe('plugins.filesystem.read.error')
  expect(plugin.getCompletedDescription('filesystem_write', {}, { success: false, error: 'test error' })).toBe('plugins.filesystem.write.error')
})

test('Filesystem plugin unknown tool', async () => {
  const plugin = new FilesystemPlugin(store.config.plugins.filesystem)
  const result = await plugin.execute(context, {
    tool: 'unknown_tool',
    parameters: { path: '/tmp/test' }
  })
  expect(result.error).toContain('not handled by this plugin')
})

test('Filesystem plugin with tools enabled filter', async () => {
  const plugin = new FilesystemPlugin(store.config.plugins.filesystem)
  plugin.toolsEnabled = ['filesystem_list']
  const tools = await plugin.getTools()
  expect(tools).toHaveLength(1)
  expect(tools[0].function.name).toBe('filesystem_list')
  expect(plugin.handlesTool('filesystem_list')).toBe(true)
  expect(plugin.handlesTool('filesystem_read')).toBe(false)
})

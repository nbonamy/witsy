import { describe, it, expect, beforeEach, vi } from 'vitest'
import { CommandRegistry } from '../../src/services/command_registry'

describe('CommandRegistry', () => {
  let registry: CommandRegistry

  beforeEach(() => {
    // Mock localStorage
    global.localStorage = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      length: 0,
      key: vi.fn()
    } as any

    registry = new CommandRegistry()
  })

  describe('basic operations', () => {
    it('should register a command', () => {
      registry.register({
        id: 'test.command',
        label: 'Test Command',
        category: 'file',
        enabled: true,
        callback: () => {}
      })

      const commands = registry.getAll()
      expect(commands).toHaveLength(1)
      expect(commands[0].id).toBe('test.command')
    })

    it('should unregister a command', () => {
      registry.register({
        id: 'test.command',
        label: 'Test Command',
        category: 'file',
        enabled: true,
        callback: () => {}
      })

      registry.unregister('test.command')
      expect(registry.getAll()).toHaveLength(0)
    })

    it('should clear all commands', () => {
      registry.register({
        id: 'test.command1',
        label: 'Test Command 1',
        category: 'file',
        enabled: true,
        callback: () => {}
      })
      registry.register({
        id: 'test.command2',
        label: 'Test Command 2',
        category: 'file',
        enabled: true,
        callback: () => {}
      })

      registry.clear()
      expect(registry.getAll()).toHaveLength(0)
    })

    it('should throw error on duplicate id registration', () => {
      registry.register({
        id: 'test.command',
        label: 'Test Command 1',
        category: 'file',
        enabled: true,
        callback: () => {}
      })

      expect(() => {
        registry.register({
          id: 'test.command',
          label: 'Test Command 2',
          category: 'file',
          enabled: true,
          callback: () => {}
        })
      }).toThrow(/already registered/)
    })
  })

  describe('categorization', () => {
    beforeEach(() => {
      registry.register({
        id: 'file.command',
        label: 'File Command',
        category: 'file',
        enabled: true,
        callback: () => {}
      })

      registry.register({
        id: 'edit.command',
        label: 'Edit Command',
        category: 'edit',
        enabled: true,
        callback: () => {}
      })

      registry.register({
        id: 'view.command',
        label: 'View Command',
        category: 'view',
        enabled: true,
        callback: () => {}
      })
    })

    it('should get commands by category', () => {
      const fileCommands = registry.getByCategory('file')
      expect(fileCommands).toHaveLength(1)
      expect(fileCommands[0].id).toBe('file.command')
    })

    it('should return empty array for empty category', () => {
      const helpCommands = registry.getByCategory('help')
      expect(helpCommands).toHaveLength(0)
    })
  })

  describe('search functionality', () => {
    beforeEach(() => {
      registry.register({
        id: 'file.newChat',
        label: 'New Chat',
        category: 'file',
        enabled: true,
        callback: () => {}
      })

      registry.register({
        id: 'file.settings',
        label: 'Settings',
        category: 'file',
        enabled: true,
        callback: () => {}
      })

      registry.register({
        id: 'view.toggleSidebar',
        label: 'Toggle Sidebar',
        category: 'view',
        enabled: true,
        callback: () => {}
      })

      registry.register({
        id: 'edit.disabled',
        label: 'Disabled Command',
        category: 'edit',
        enabled: false,
        callback: () => {}
      })
    })

    it('should find exact matches', () => {
      const results = registry.search('Settings')
      expect(results.length).toBeGreaterThan(0)
      expect(results[0].id).toBe('file.settings')
    })

    it('should find partial matches', () => {
      const results = registry.search('new')
      expect(results.find(r => r.id === 'file.newChat')).toBeDefined()
    })

    it('should be case insensitive', () => {
      const results = registry.search('SETTINGS')
      expect(results.find(r => r.id === 'file.settings')).toBeDefined()
    })

    it('should do fuzzy matching', () => {
      const results = registry.search('tgsb')
      expect(results.find(r => r.id === 'view.toggleSidebar')).toBeDefined()
    })

    it('should search in keywords', () => {
      registry.register({
        id: 'file.preferences',
        label: 'Preferences',
        category: 'file',
        enabled: true,
        keywords: ['settings', 'config', 'options'],
        callback: () => {}
      })

      const results = registry.search('config')
      expect(results.find(r => r.id === 'file.preferences')).toBeDefined()
    })

    it('should return empty array for no matches', () => {
      const results = registry.search('zzzzzzzzz')
      expect(results).toHaveLength(0)
    })

    it('should include disabled commands in search results', () => {
      const results = registry.search('Disabled')
      expect(results.find(r => r.id === 'edit.disabled')).toBeDefined()
    })

    it('should sort results by relevance then alphabetically', () => {
      registry.register({
        id: 'exact',
        label: 'Chat',
        category: 'file',
        enabled: true,
        callback: () => {}
      })

      const results = registry.search('chat')

      // Exact match should be first
      expect(results[0].id).toBe('exact')

      // "New Chat" should be second (starts with)
      expect(results[1].id).toBe('file.newChat')
    })
  })

  describe('recent commands', () => {
    beforeEach(() => {
      for (let i = 0; i < 15; i++) {
        registry.register({
          id: `command.${i}`,
          label: `Command ${i}`,
          category: 'file',
          enabled: true,
          callback: () => {}
        })
      }
    })

    it('should track executed commands', () => {
      registry.markAsExecuted('command.0')
      registry.markAsExecuted('command.1')

      const recent = registry.getRecent()
      expect(recent).toHaveLength(2)
      expect(recent[0].id).toBe('command.1') // Most recent first
      expect(recent[1].id).toBe('command.0')
    })

    it('should limit recent commands to 10', () => {
      for (let i = 0; i < 15; i++) {
        registry.markAsExecuted(`command.${i}`)
      }

      const recent = registry.getRecent()
      expect(recent).toHaveLength(10)
      expect(recent[0].id).toBe('command.14') // Most recent
    })

    it('should not duplicate in recent commands', () => {
      registry.markAsExecuted('command.0')
      registry.markAsExecuted('command.1')
      registry.markAsExecuted('command.0') // Execute again

      const recent = registry.getRecent()
      expect(recent).toHaveLength(2)
      expect(recent[0].id).toBe('command.0') // Moved to top
      expect(recent[1].id).toBe('command.1')
    })

    it('should persist recent commands to localStorage', () => {
      registry.markAsExecuted('command.0')

      expect(global.localStorage.setItem).toHaveBeenCalledWith(
        'commandPalette.recent',
        expect.stringContaining('command.0')
      )
    })

    it('should load recent commands from localStorage', () => {
      global.localStorage.getItem = vi.fn(() =>
        JSON.stringify(['command.5', 'command.3'])
      )

      const newRegistry = new CommandRegistry()
      for (let i = 0; i < 15; i++) {
        newRegistry.register({
          id: `command.${i}`,
          label: `Command ${i}`,
          category: 'file',
          enabled: true,
          callback: () => {}
        })
      }

      const recent = newRegistry.getRecent()
      expect(recent).toHaveLength(2)
      expect(recent[0].id).toBe('command.5')
    })

    it('should exclude non-existent commands from recent', () => {
      global.localStorage.getItem = vi.fn(() =>
        JSON.stringify(['command.0', 'nonexistent', 'command.1'])
      )

      const newRegistry = new CommandRegistry()
      newRegistry.register({
        id: 'command.0',
        label: 'Command 0',
        category: 'file',
        enabled: true,
        callback: () => {}
      })
      newRegistry.register({
        id: 'command.1',
        label: 'Command 1',
        category: 'file',
        enabled: true,
        callback: () => {}
      })

      const recent = newRegistry.getRecent()
      expect(recent).toHaveLength(2)
      expect(recent.find(r => r.id === 'nonexistent')).toBeUndefined()
    })
  })

  describe('callback execution', () => {
    it('should execute sync callback', () => {
      let executed = false

      registry.register({
        id: 'test.command',
        label: 'Test Command',
        category: 'file',
        enabled: true,
        callback: () => { executed = true }
      })

      const command = registry.getAll()[0]
      command.callback()
      expect(executed).toBe(true)
    })

    it('should execute async callback', async () => {
      let executed = false

      registry.register({
        id: 'test.command',
        label: 'Test Command',
        category: 'file',
        enabled: true,
        callback: async () => {
          await new Promise(resolve => setTimeout(resolve, 10))
          executed = true
        }
      })

      const command = registry.getAll()[0]
      await command.callback()
      expect(executed).toBe(true)
    })
  })

  describe('enabled state', () => {
    it('should respect enabled flag', () => {
      registry.register({
        id: 'enabled.command',
        label: 'Enabled Command',
        category: 'file',
        enabled: true,
        callback: () => {}
      })

      registry.register({
        id: 'disabled.command',
        label: 'Disabled Command',
        category: 'file',
        enabled: false,
        callback: () => {}
      })

      const all = registry.getAll()
      expect(all[0].enabled).toBe(true)
      expect(all[1].enabled).toBe(false)
    })
  })
})

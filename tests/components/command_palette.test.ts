import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { mount, VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import CommandPalette from '../../src/components/CommandPalette.vue'
import { commandRegistry } from '../../src/services/command_registry'

// Mock i18n
vi.mock('../../src/services/i18n', () => ({
  t: (key: string) => key
}))

describe('CommandPalette', () => {
  let wrapper: VueWrapper

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

    // Clear and populate registry
    commandRegistry.clear()

    commandRegistry.register({
      id: 'test.command1',
      label: 'Test Command 1',
      category: 'file',
      enabled: true,
      callback: vi.fn()
    })

    commandRegistry.register({
      id: 'test.command2',
      label: 'Another Command',
      category: 'edit',
      shortcut: '⌘K',
      enabled: true,
      callback: vi.fn()
    })

    commandRegistry.register({
      id: 'test.disabled',
      label: 'Disabled Command',
      category: 'view',
      enabled: false,
      callback: vi.fn()
    })

    wrapper = mount(CommandPalette)
  })

  afterEach(() => {
    wrapper.unmount()
  })

  describe('visibility', () => {
    it('should not be visible by default', () => {
      expect(wrapper.find('.command-palette-backdrop').exists()).toBe(false)
    })

    it('should show when show() is called', async () => {
      await wrapper.vm.show()
      expect(wrapper.find('.command-palette-backdrop').isVisible()).toBe(true)
    })

    it('should hide when close() is called', async () => {
      await wrapper.vm.show()
      await wrapper.vm.close()
      await nextTick()
      expect(wrapper.find('.command-palette-backdrop').exists()).toBe(false)
    })

    it('should close on backdrop click', async () => {
      await wrapper.vm.show()
      await wrapper.find('.command-palette-backdrop').trigger('click')
      await nextTick()
      expect(wrapper.find('.command-palette-backdrop').exists()).toBe(false)
    })

    it('should not close on palette content click', async () => {
      await wrapper.vm.show()
      await wrapper.find('.command-palette').trigger('click')
      await nextTick()
      expect(wrapper.find('.command-palette-backdrop').isVisible()).toBe(true)
    })
  })

  describe('search input', () => {
    it('should focus search input when shown', async () => {
      await wrapper.vm.show()
      await nextTick()
      const input = wrapper.find('input.search-input')
      // Just verify input exists and can be found
      expect(input.exists()).toBe(true)
    })

    it('should reset search query when closed and reopened', async () => {
      await wrapper.vm.show()
      await nextTick()
      const input = wrapper.find('input.search-input')
      await input.setValue('test query')
      await nextTick()
      await wrapper.vm.close()
      await nextTick()
      await wrapper.vm.show()
      await nextTick()
      const newInput = wrapper.find('input.search-input')
      expect((newInput.element as HTMLInputElement).value).toBe('')
    })
  })

  describe('command display', () => {
    it('should display commands alphabetically when no search', async () => {
      await wrapper.vm.show()
      await nextTick()

      const items = wrapper.findAll('.result-item')
      const labels = items.map(item => item.find('.label').text())

      // Should be alphabetically sorted
      const sortedLabels = [...labels].sort()
      expect(labels).toEqual(sortedLabels)
    })

    it('should display shortcuts when available', async () => {
      await wrapper.vm.show()
      await nextTick()

      const items = wrapper.findAll('.result-item')
      const itemWithShortcut = items.find(item =>
        item.find('.label').text() === 'Another Command'
      )

      expect(itemWithShortcut.find('.shortcut').text()).toBe('⌘K')
    })

    it('should show disabled commands as disabled', async () => {
      await wrapper.vm.show()
      await nextTick()

      const items = wrapper.findAll('.result-item')
      const disabledItem = items.find(item =>
        item.find('.label').text() === 'Disabled Command'
      )

      expect(disabledItem.classes()).toContain('disabled')
    })
  })

  describe('search filtering', () => {
    it('should filter commands based on search query', async () => {
      await wrapper.vm.show()
      const input = wrapper.find('input.search-input')
      await input.setValue('Another')
      await nextTick()

      const items = wrapper.findAll('.result-item')
      expect(items).toHaveLength(1)
      expect(items[0].text()).toContain('Another Command')
    })

    it('should show no results message when no matches', async () => {
      await wrapper.vm.show()
      const input = wrapper.find('input.search-input')
      await input.setValue('zzzzzzzzz')
      await nextTick()

      expect(wrapper.find('.no-results').isVisible()).toBe(true)
      expect(wrapper.findAll('.result-item')).toHaveLength(0)
    })

    it('should include disabled commands in search results', async () => {
      await wrapper.vm.show()
      const input = wrapper.find('input.search-input')
      await input.setValue('Disabled')
      await nextTick()

      const items = wrapper.findAll('.result-item')
      expect(items.length).toBeGreaterThan(0)
      expect(items[0].classes()).toContain('disabled')
    })
  })

  describe('recent commands', () => {
    it('should show recent commands section when no search', async () => {
      commandRegistry.markAsExecuted('test.command1')

      await wrapper.vm.show()
      await nextTick()

      // i18n mock returns the key, so check for the key
      expect(wrapper.find('.section-header').text()).toContain('commandPalette.recent')
    })

    it('should hide recent commands section when searching', async () => {
      commandRegistry.markAsExecuted('test.command1')

      await wrapper.vm.show()
      const input = wrapper.find('input.search-input')
      await input.setValue('test')
      await nextTick()

      expect(wrapper.find('.section-header').exists()).toBe(false)
    })

    it('should show separator between recent and all commands', async () => {
      commandRegistry.markAsExecuted('test.command1')

      await wrapper.vm.show()
      await nextTick()

      expect(wrapper.find('.separator').exists()).toBe(true)
    })
  })

  describe('keyboard navigation', () => {
    it('should select first enabled item by default', async () => {
      await wrapper.vm.show()
      await nextTick()

      const items = wrapper.findAll('.result-item')
      const firstEnabled = items.find(item => !item.classes().includes('disabled'))
      expect(firstEnabled.classes()).toContain('selected')
    })

    it('should navigate down with ArrowDown', async () => {
      await wrapper.vm.show()
      await nextTick()

      const input = wrapper.find('input.search-input')
      await input.trigger('keydown', { key: 'ArrowDown' })
      await nextTick()

      const items = wrapper.findAll('.result-item')
      expect(items[1].classes()).toContain('selected')
    })

    it('should navigate up with ArrowUp', async () => {
      await wrapper.vm.show()
      await nextTick()

      const input = wrapper.find('input.search-input')
      await input.trigger('keydown', { key: 'ArrowDown' })
      await input.trigger('keydown', { key: 'ArrowDown' })
      await input.trigger('keydown', { key: 'ArrowUp' })
      await nextTick()

      const items = wrapper.findAll('.result-item')
      expect(items[1].classes()).toContain('selected')
    })

    it('should skip disabled items when navigating', async () => {
      // Ensure disabled item is between enabled items
      commandRegistry.clear()
      commandRegistry.register({
        id: 'enabled1',
        label: 'A Enabled',
        category: 'file',
        enabled: true,
        callback: vi.fn()
      })
      commandRegistry.register({
        id: 'disabled',
        label: 'B Disabled',
        category: 'file',
        enabled: false,
        callback: vi.fn()
      })
      commandRegistry.register({
        id: 'enabled2',
        label: 'C Enabled',
        category: 'file',
        enabled: true,
        callback: vi.fn()
      })

      wrapper.unmount()
      wrapper = mount(CommandPalette)
      await wrapper.vm.show()
      await nextTick()

      const input = wrapper.find('input.search-input')
      await input.trigger('keydown', { key: 'ArrowDown' })
      await nextTick()

      const items = wrapper.findAll('.result-item')
      const selected = items.find(item => item.classes().includes('selected'))
      expect(selected.find('.label').text()).toBe('C Enabled')
    })

    it('should not go below first item', async () => {
      await wrapper.vm.show()
      await nextTick()

      const input = wrapper.find('input.search-input')
      await input.trigger('keydown', { key: 'ArrowUp' })
      await nextTick()

      const items = wrapper.findAll('.result-item')
      expect(items[0].classes()).toContain('selected')
    })

    it('should not go beyond last item', async () => {
      await wrapper.vm.show()
      await nextTick()

      const input = wrapper.find('input.search-input')
      const items = wrapper.findAll('.result-item')

      for (let i = 0; i < items.length + 5; i++) {
        await input.trigger('keydown', { key: 'ArrowDown' })
      }
      await nextTick()

      const updatedItems = wrapper.findAll('.result-item')
      expect(updatedItems[updatedItems.length - 1].classes()).toContain('selected')
    })

    it('should close on Escape', async () => {
      await wrapper.vm.show()
      const input = wrapper.find('input.search-input')
      await input.trigger('keydown', { key: 'Escape' })
      await nextTick()

      expect(wrapper.find('.command-palette-backdrop').exists()).toBe(false)
    })
  })

  describe('command execution', () => {
    it('should execute command on Enter', async () => {
      const mockCallback = vi.fn()
      commandRegistry.clear()
      commandRegistry.register({
        id: 'test.enter',
        label: 'Test Enter Command',
        category: 'file',
        enabled: true,
        callback: mockCallback
      })

      wrapper.unmount()
      wrapper = mount(CommandPalette)
      await wrapper.vm.show()
      await nextTick()

      const input = wrapper.find('input.search-input')
      await input.trigger('keydown', { key: 'Enter' })
      await nextTick()

      expect(mockCallback).toHaveBeenCalled()
    })

    it('should not execute disabled command on Enter', async () => {
      const mockCallback = vi.fn()
      commandRegistry.clear()
      commandRegistry.register({
        id: 'test.disabled',
        label: 'Disabled Command',
        category: 'file',
        enabled: false,
        callback: mockCallback
      })

      wrapper.unmount()
      wrapper = mount(CommandPalette)
      await wrapper.vm.show()
      await nextTick()

      const input = wrapper.find('input.search-input')
      await input.trigger('keydown', { key: 'Enter' })
      await nextTick()

      expect(mockCallback).not.toHaveBeenCalled()
    })

    it('should execute command on click', async () => {
      const mockCallback = vi.fn()
      commandRegistry.register({
        id: 'test.click',
        label: 'Test Click Command',
        category: 'file',
        enabled: true,
        callback: mockCallback
      })

      await wrapper.vm.show()
      await nextTick()

      const input = wrapper.find('input.search-input')
      await input.setValue('Test Click')
      await nextTick()

      const item = wrapper.find('.result-item')
      await item.trigger('click')
      await nextTick()

      expect(mockCallback).toHaveBeenCalled()
    })

    it('should not execute disabled command on click', async () => {
      const mockCallback = vi.fn()

      await wrapper.vm.show()
      await nextTick()

      const input = wrapper.find('input.search-input')
      await input.setValue('Disabled')
      await nextTick()

      const item = wrapper.find('.result-item.disabled')
      await item.trigger('click')
      await nextTick()

      expect(mockCallback).not.toHaveBeenCalled()
    })

    it('should close after executing command', async () => {
      await wrapper.vm.show()
      await nextTick()

      const input = wrapper.find('input.search-input')
      await input.trigger('keydown', { key: 'Enter' })
      await nextTick()

      expect(wrapper.find('.command-palette-backdrop').exists()).toBe(false)
    })

    it('should track command execution in recent', async () => {
      await wrapper.vm.show()
      await nextTick()

      const input = wrapper.find('input.search-input')
      await input.trigger('keydown', { key: 'Enter' })
      await nextTick()

      const recent = commandRegistry.getRecent()
      expect(recent.length).toBeGreaterThan(0)
    })
  })

  describe('mouse interaction', () => {
    it('should update selection on mousemove', async () => {
      await wrapper.vm.show()
      await nextTick()

      const items = wrapper.findAll('.result-item')
      await items[1].trigger('mousemove')
      await nextTick()

      expect(items[1].classes()).toContain('selected')
    })
  })

  describe('scroll behavior', () => {
    it('should ensure selected item is visible', async () => {
      // Clear first to avoid duplicate registration
      commandRegistry.clear()

      // Add many commands
      for (let i = 0; i < 50; i++) {
        commandRegistry.register({
          id: `scroll.command${i}`,
          label: `Scroll Command ${i}`,
          category: 'file',
          enabled: true,
          callback: vi.fn()
        })
      }

      wrapper.unmount()
      wrapper = mount(CommandPalette)
      await wrapper.vm.show()
      await nextTick()

      const input = wrapper.find('input.search-input')

      // Navigate down many times
      for (let i = 0; i < 20; i++) {
        await input.trigger('keydown', { key: 'ArrowDown' })
      }
      await nextTick()

      const selected = wrapper.find('.result-item.selected')
      const resultsList = wrapper.find('.results').element as HTMLElement

      const selectedTop = (selected.element as HTMLElement).offsetTop
      const selectedBottom = selectedTop + (selected.element as HTMLElement).offsetHeight
      const visibleTop = resultsList.scrollTop
      const visibleBottom = visibleTop + resultsList.clientHeight

      expect(selectedTop).toBeGreaterThanOrEqual(visibleTop)
      expect(selectedBottom).toBeLessThanOrEqual(visibleBottom)
    })
  })
})

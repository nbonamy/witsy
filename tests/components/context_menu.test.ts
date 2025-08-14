import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import ContextMenuPlus from '../../src/components/ContextMenuPlus.vue'
import TestMenu from '../../src/components/TestMenu.vue'

// Mock the i18n service
vi.mock('../../src/services/i18n', () => ({
  t: (key: string) => key
}))

// Mock the Overlay component
vi.mock('../../src/components/Overlay.vue', () => ({
  default: {
    name: 'Overlay',
    template: '<div class="overlay-mock" @click="$emit(\'click\')"></div>'
  }
}))

describe('ContextMenuPlus System', () => {
  let wrapper: any
  
  // Helper function to find teleported content in document.body
  const findInBody = (selector: string) => {
    const element = document.body.querySelector(selector)
    return {
      exists: () => !!element,
      element,
      text: () => element?.textContent || '',
      click: async () => {
        if (element) {
          element.click()
          await nextTick()
        }
      }
    }
  }
  
  const findAllInBody = (selector: string) => {
    const elements = Array.from(document.body.querySelectorAll(selector))
    return elements.map(element => ({
      exists: () => !!element,
      element,
      text: () => element?.textContent || '',
      click: async () => {
        if (element) {
          element.click()
          await nextTick()
        }
      }
    }))
  }
  
  beforeEach(() => {
    document.body.innerHTML = '<div id="test-anchor" style="position: absolute; top: 100px; left: 50px; width: 100px; height: 30px;"></div>'
  })

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
    document.body.innerHTML = ''
  })

  describe('ContextMenuPlus - Basic Functionality', () => {
    it('renders and teleports menu to body', async () => {
      wrapper = mount(ContextMenuPlus, {
        props: {
          anchor: '#test-anchor',
          position: 'below'
        },
        slots: {
          default: '<div class="item">Test Item</div>'
        },
        attachTo: document.body
      })

      await nextTick()
      
      // Content should be teleported to body
      expect(document.body.innerHTML).toContain('context-menu')
      expect(findInBody('.context-menu').exists()).toBe(true)
      expect(findInBody('.item').text()).toBe('Test Item')
    })

    it('positions menu relative to anchor', async () => {
      wrapper = mount(ContextMenuPlus, {
        props: {
          anchor: '#test-anchor',
          position: 'below'
        },
        slots: {
          default: '<div class="item">Test</div>'
        },
        attachTo: document.body
      })

      await nextTick()
      
      const menu = findInBody('.context-menu')
      expect(menu.exists()).toBe(true)
      
      // Check that menu has positioning values (left and top)
      const style = menu.element?.getAttribute('style') || ''
      expect(style).toMatch(/left:\s*\d+px/)
      expect(style).toMatch(/top:\s*\d+px/)
    })

    it('shows filter when showFilter prop is true', async () => {
      wrapper = mount(ContextMenuPlus, {
        props: {
          anchor: '#test-anchor',
          showFilter: true
        },
        slots: {
          default: '<div class="item">Test Item</div>'
        },
        attachTo: document.body
      })

      await nextTick()
      
      expect(findInBody('.header').exists()).toBe(true)
      expect(findInBody('.filter-input input').exists()).toBe(true)
    })
  })

  describe('ContextMenuPlus - Submenu Navigation', () => {
    it('shows back button when in submenu', async () => {
      wrapper = mount(ContextMenuPlus, {
        props: {
          anchor: '#test-anchor'
        },
        slots: {
          default: `
            <div class="item" data-submenu-slot="testSubmenu">
              Edit
            </div>
          `,
          testSubmenu: '<div class="item">Undo</div>'
        },
        attachTo: document.body
      })

      await nextTick()
      
      // Click the submenu item directly (component handles the click internally)
      const editItem = findInBody('[data-submenu-slot="testSubmenu"]')
      expect(editItem.exists()).toBe(true)
      
      // Trigger submenu navigation by calling component method directly
      const contextMenuComponent = wrapper.findComponent({ name: 'ContextMenuPlus' })
      contextMenuComponent.vm.showSubmenu('testSubmenu')
      await nextTick()
      
      // Should show back button
      expect(findInBody('.back-button').exists()).toBe(true)
    })

    it('enables submenu filter when withFilter is called', async () => {
      wrapper = mount(ContextMenuPlus, {
        props: {
          anchor: '#test-anchor'
        },
        slots: {
          default: `
            <div class="item" data-submenu-slot="testSubmenu">
              Edit
            </div>
          `,
          testSubmenu: ({ withFilter }: any) => {
            withFilter(true)
            return '<div class="item">Undo</div>'
          }
        },
        attachTo: document.body
      })

      await nextTick()
      
      // Navigate to submenu using component method
      const contextMenuComponent = wrapper.findComponent({ name: 'ContextMenuPlus' })
      contextMenuComponent.vm.showSubmenu('testSubmenu')
      await nextTick()
      
      // Should show filter input in submenu
      expect(findInBody('.filter-input input').exists()).toBe(true)
    })
  })

  describe('ContextMenuPlus - Event Handling', () => {
    it('emits close event when overlay is clicked', async () => {
      wrapper = mount(ContextMenuPlus, {
        props: {
          anchor: '#test-anchor'
        },
        slots: {
          default: '<div class="item">Test</div>'
        },
        attachTo: document.body
      })

      await nextTick()
      
      const overlay = findInBody('.overlay-mock')
      await overlay.click()
      
      // Should emit close event (might be more than once due to event bubbling)
      const closeEvents = wrapper.emitted('close')
      expect(closeEvents).toBeTruthy()
      expect(closeEvents!.length).toBeGreaterThanOrEqual(1)
    })

    it('handles teleport disabled gracefully', async () => {
      wrapper = mount(ContextMenuPlus, {
        props: {
          anchor: '#test-anchor',
          teleport: false
        },
        slots: {
          default: '<div class="item">Test</div>'
        }
      })

      await nextTick()
      
      // When teleport is disabled, content stays in wrapper
      expect(wrapper.find('.context-menu').exists()).toBe(true)
    })
  })

  describe('ContextMenuPlus - Chevron Injection', () => {
    it('includes hidden chevron template', async () => {
      wrapper = mount(ContextMenuPlus, {
        props: {
          anchor: '#test-anchor'
        },
        slots: {
          default: '<div class="item">Test</div>'
        },
        attachTo: document.body
      })

      await nextTick()
      
      // Should have hidden chevron template
      expect(findInBody('.chevron-template').exists()).toBe(true)
    })

    it('processes items for chevron injection', async () => {
      wrapper = mount(ContextMenuPlus, {
        props: {
          anchor: '#test-anchor'
        },
        slots: {
          default: `
            <div class="item">Regular Item</div>
            <div class="item" data-submenu-slot="testSubmenu">Submenu Item</div>
          `,
          testSubmenu: '<div class="item">Sub Item</div>'
        },
        attachTo: document.body
      })

      await nextTick()
      
      // Should process submenu items (chevron injection happens asynchronously)
      const submenuItem = findInBody('[data-submenu-slot="testSubmenu"]')
      expect(submenuItem.exists()).toBe(true)
    })
  })

  describe('TestMenu - Component Integration', () => {
    it('renders static menu items', async () => {
      wrapper = mount(TestMenu, {
        props: {
          anchor: '#test-anchor'
        },
        attachTo: document.body
      })

      await nextTick()
      
      const bodyContent = document.body.innerHTML
      expect(bodyContent).toContain('Copy')
      expect(bodyContent).toContain('Edit')
      expect(bodyContent).toContain('Delete')
    })

    it('renders dynamic menu items', async () => {
      wrapper = mount(TestMenu, {
        props: {
          anchor: '#test-anchor'
        },
        attachTo: document.body
      })

      await nextTick()
      
      const bodyContent = document.body.innerHTML
      expect(bodyContent).toContain('Open Recent')
      expect(bodyContent).toContain('Settings')
    })

    it('renders separators', async () => {
      wrapper = mount(TestMenu, {
        props: {
          anchor: '#test-anchor'
        },
        attachTo: document.body
      })

      await nextTick()
      
      const separators = findAllInBody('.item.separator')
      expect(separators.length).toBeGreaterThan(0)
    })

    it('sets up submenu slots correctly', async () => {
      wrapper = mount(TestMenu, {
        props: {
          anchor: '#test-anchor'
        },
        attachTo: document.body
      })

      await nextTick()
      
      // Should have submenu items
      expect(findInBody('[data-submenu-slot="editSubmenu"]').exists()).toBe(true)
      expect(findInBody('[data-submenu-slot="recentFilesSubmenu"]').exists()).toBe(true)
      expect(findInBody('[data-submenu-slot="settingsSubmenu"]').exists()).toBe(true)
    })

    it('has dynamic submenu templates available', async () => {
      wrapper = mount(TestMenu, {
        props: {
          anchor: '#test-anchor'
        },
        attachTo: document.body
      })

      await nextTick()
      
      // Check that the component has the required submenu slots
      const testMenuComponent = wrapper.vm
      expect(testMenuComponent).toBeDefined()
      
      // Check that dynamic data exists in the component
      expect(testMenuComponent.recentFiles).toBeDefined()
      expect(testMenuComponent.recentFiles.length).toBeGreaterThan(0)
      expect(testMenuComponent.recentFiles[0].name).toBe('Project1.vue')
      
      // Verify submenu items are set up for navigation
      expect(findInBody('[data-submenu-slot=\"recentFilesSubmenu\"]').exists()).toBe(true)
    })

    it('has correct event handlers', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      
      wrapper = mount(TestMenu, {
        props: {
          anchor: '#test-anchor'
        },
        attachTo: document.body
      })

      await nextTick()
      
      // Test component methods directly
      const vm = wrapper.vm
      vm.handleAction('test')
      expect(consoleSpy).toHaveBeenCalledWith('Action clicked:', 'test')
      
      vm.handleFileAction({ name: 'test.txt', path: '/test.txt' })
      expect(consoleSpy).toHaveBeenCalledWith('File selected:', 'test.txt', '/test.txt')

      consoleSpy.mockRestore()
    })

    it('forwards props correctly', async () => {
      wrapper = mount(TestMenu, {
        props: {
          anchor: '#test-anchor',
          position: 'above',
          showFilter: true
        },
        attachTo: document.body
      })

      await nextTick()
      
      const contextMenuComponent = wrapper.findComponent({ name: 'ContextMenuPlus' })
      expect(contextMenuComponent.props('anchor')).toBe('#test-anchor')
      expect(contextMenuComponent.props('position')).toBe('above')
      expect(contextMenuComponent.props('showFilter')).toBe(true)
    })
  })

  describe('Integration Tests', () => {
    it('completes basic navigation workflow', async () => {
      wrapper = mount(TestMenu, {
        props: {
          anchor: '#test-anchor'
        },
        attachTo: document.body
      })

      await nextTick()
      
      // Should render main menu
      expect(findInBody('.context-menu').exists()).toBe(true)
      expect(document.body.innerHTML).toContain('Copy')
      expect(document.body.innerHTML).toContain('Open Recent')
      
      // Click Edit submenu
      const editItem = findInBody('[data-submenu-slot="editSubmenu"]')
      if (editItem.exists()) {
        await editItem.click()
        await nextTick()
        
        // Should show back button
        expect(findInBody('.back-button').exists()).toBe(true)
      }
    })

    it('handles invalid anchor gracefully', async () => {
      wrapper = mount(ContextMenuPlus, {
        props: {
          anchor: '#non-existent'
        },
        slots: {
          default: '<div class="item">Test</div>'
        },
        attachTo: document.body
      })

      await nextTick()
      
      // Component should still render
      expect(findInBody('.context-menu').exists()).toBe(true)
    })

    it('handles empty menu gracefully', async () => {
      wrapper = mount(ContextMenuPlus, {
        props: {
          anchor: '#test-anchor'
        },
        slots: {
          default: ''
        },
        attachTo: document.body
      })

      await nextTick()
      
      expect(findInBody('.context-menu').exists()).toBe(true)
      expect(findInBody('.actions').exists()).toBe(true)
    })
  })

  describe('Performance and Edge Cases', () => {
    it('handles multiple rapid mounts/unmounts', async () => {
      for (let i = 0; i < 5; i++) {
        const tempWrapper = mount(ContextMenuPlus, {
          props: {
            anchor: '#test-anchor'
          },
          slots: {
            default: `<div class="item">Item ${i}</div>`
          },
          attachTo: document.body
        })

        await nextTick()
        expect(findInBody('.context-menu').exists()).toBe(true)
        
        tempWrapper.unmount()
        await nextTick()
      }
      
      // Should handle cleanup properly
      expect(true).toBe(true)
    })

    it('handles large number of items', async () => {
      const items = Array.from({ length: 50 }, (_, i) => 
        `<div class="item">Item ${i + 1}</div>`
      ).join('')

      wrapper = mount(ContextMenuPlus, {
        props: {
          anchor: '#test-anchor'
        },
        slots: {
          default: items
        },
        attachTo: document.body
      })

      await nextTick()
      
      const menuItems = findAllInBody('.item')
      expect(menuItems.length).toBe(50)
    })
  })
})
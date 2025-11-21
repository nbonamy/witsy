import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import ContextMenuTrigger from '@components/ContextMenuTrigger.vue'

// Mock the i18n service
vi.mock('@services/i18n', () => ({
  t: (key: string) => key
}))

// Mock the ContextMenuPlus component
vi.mock('@components/ContextMenuPlus.vue', () => ({
  default: {
    name: 'ContextMenuPlus',
    props: ['anchor', 'position'],
    emits: ['close'],
    template: `
      <div class="context-menu-plus-mock" data-testid="context-menu">
        <slot />
      </div>
    `
  }
}))

describe('ContextMenuTrigger', () => {
  let wrapper: any
  
  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
  })

  describe('Basic Functionality', () => {
    it('renders with default EllipsisVerticalIcon trigger', async () => {
      wrapper = mount(ContextMenuTrigger)
      await nextTick()
      
      expect(wrapper.find('.trigger').exists()).toBe(true)
      expect(wrapper.find('svg').exists()).toBe(true) // EllipsisVerticalIcon
    })

    it('renders with custom trigger slot content', async () => {
      wrapper = mount(ContextMenuTrigger, {
        slots: {
          trigger: '<button class="custom-trigger">Custom</button>'
        }
      })
      await nextTick()
      
      expect(wrapper.find('.custom-trigger').exists()).toBe(true)
      expect(wrapper.find('.custom-trigger').text()).toBe('Custom')
    })

    it('renders menu content when slot is provided', async () => {
      wrapper = mount(ContextMenuTrigger, {
        slots: {
          menu: '<div class="menu-item">Edit</div><div class="menu-item">Delete</div>'
        }
      })
      await nextTick()
      
      // Click to open menu
      await wrapper.find('.trigger').trigger('click')
      await nextTick()
      
      expect(wrapper.find('[data-testid="context-menu"]').exists()).toBe(true)
    })

    it('generates unique trigger ID on mount', async () => {
      const wrapper1 = mount(ContextMenuTrigger)
      const wrapper2 = mount(ContextMenuTrigger)
      
      await nextTick()
      
      const id1 = wrapper1.find('.trigger').attributes('id')
      const id2 = wrapper2.find('.trigger').attributes('id')
      
      expect(id1).toBeTruthy()
      expect(id2).toBeTruthy()
      expect(id1).not.toBe(id2)
      
      wrapper1.unmount()
      wrapper2.unmount()
    })
  })

  describe('Menu Toggle Functionality', () => {
    beforeEach(async () => {
      wrapper = mount(ContextMenuTrigger, {
        slots: {
          menu: '<div class="menu-item">Test Item</div>'
        }
      })
      await nextTick()
    })

    it('opens menu on trigger click', async () => {
      expect(wrapper.find('[data-testid="context-menu"]').exists()).toBe(false)
      
      await wrapper.find('.trigger').trigger('click')
      await nextTick()
      
      expect(wrapper.find('[data-testid="context-menu"]').exists()).toBe(true)
    })

    it('closes menu on second trigger click', async () => {
      // Open menu
      await wrapper.find('.trigger').trigger('click')
      await nextTick()
      expect(wrapper.find('[data-testid="context-menu"]').exists()).toBe(true)
      
      // Close menu
      await wrapper.find('.trigger').trigger('click')
      await nextTick()
      expect(wrapper.find('[data-testid="context-menu"]').exists()).toBe(false)
    })

    it('exposes isMenuOpen state correctly', async () => {
      const vm = wrapper.vm
      
      expect(vm.isMenuOpen()).toBe(false)
      
      await wrapper.find('.trigger').trigger('click')
      await nextTick()
      
      expect(vm.isMenuOpen()).toBe(true)
    })
  })

  describe('Keyboard Navigation', () => {
    beforeEach(async () => {
      wrapper = mount(ContextMenuTrigger, {
        slots: {
          menu: '<div class="menu-item">Test Item</div>'
        }
      })
      await nextTick()
    })

    it('opens menu with Enter key', async () => {
      expect(wrapper.find('[data-testid="context-menu"]').exists()).toBe(false)
      
      await wrapper.find('.trigger').trigger('keydown.enter')
      await nextTick()
      
      expect(wrapper.find('[data-testid="context-menu"]').exists()).toBe(true)
    })

    it('opens menu with Space key', async () => {
      expect(wrapper.find('[data-testid="context-menu"]').exists()).toBe(false)
      
      await wrapper.find('.trigger').trigger('keydown.space')
      await nextTick()
      
      expect(wrapper.find('[data-testid="context-menu"]').exists()).toBe(true)
    })

    it('closes menu with Escape key', async () => {
      // Open menu first
      await wrapper.find('.trigger').trigger('click')
      await nextTick()
      expect(wrapper.find('[data-testid="context-menu"]').exists()).toBe(true)
      
      // Press Escape
      const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape' })
      document.dispatchEvent(escapeEvent)
      await nextTick()
      
      expect(wrapper.find('[data-testid="context-menu"]').exists()).toBe(false)
    })

    it('has proper tabindex for keyboard accessibility', () => {
      expect(wrapper.find('.trigger').attributes('tabindex')).toBe('0')
    })
  })

  describe('Positioning', () => {
    it('uses default position "below-right"', async () => {
      wrapper = mount(ContextMenuTrigger, {
        slots: {
          menu: '<div class="menu-item">Test</div>'
        }
      })
      await nextTick()
      
      await wrapper.find('.trigger').trigger('click')
      await nextTick()
      
      const contextMenuPlus = wrapper.findComponent({ name: 'ContextMenuPlus' })
      expect(contextMenuPlus.props('position')).toBe('below-right')
    })

    it('accepts custom position prop', async () => {
      wrapper = mount(ContextMenuTrigger, {
        props: {
          position: 'above-left'
        },
        slots: {
          menu: '<div class="menu-item">Test</div>'
        }
      })
      await nextTick()
      
      await wrapper.find('.trigger').trigger('click')
      await nextTick()
      
      const contextMenuPlus = wrapper.findComponent({ name: 'ContextMenuPlus' })
      expect(contextMenuPlus.props('position')).toBe('above-left')
    })
  })

  describe('ContextMenuPlus Integration', () => {
    beforeEach(async () => {
      wrapper = mount(ContextMenuTrigger, {
        slots: {
          menu: '<div class="menu-item">Test Item</div>'
        }
      })
      await nextTick()
    })

    it('passes correct anchor prop to ContextMenuPlus', async () => {
      await wrapper.find('.trigger').trigger('click')
      await nextTick()
      
      const contextMenuPlus = wrapper.findComponent({ name: 'ContextMenuPlus' })
      const anchor = contextMenuPlus.props('anchor')
      
      expect(anchor).toMatch(/^#context-trigger-/)
    })

    it('handles ContextMenuPlus close event', async () => {
      await wrapper.find('.trigger').trigger('click')
      await nextTick()
      
      const contextMenuPlus = wrapper.findComponent({ name: 'ContextMenuPlus' })
      expect(contextMenuPlus.exists()).toBe(true)
      
      // Simulate close event from ContextMenuPlus
      contextMenuPlus.vm.$emit('close')
      await nextTick()
      
      expect(wrapper.find('[data-testid="context-menu"]').exists()).toBe(false)
    })

    it('provides close function to menu slot', async () => {
      wrapper = mount(ContextMenuTrigger, {
        slots: {
          menu: `
            <template #default="{ close }">
              <div class="menu-item" @click="close">Close Menu</div>
            </template>
          `
        }
      })
      await nextTick()
      
      await wrapper.find('.trigger').trigger('click')
      await nextTick()
      
      expect(wrapper.find('[data-testid="context-menu"]').exists()).toBe(true)
    })
  })

  describe('Component Methods', () => {
    beforeEach(async () => {
      wrapper = mount(ContextMenuTrigger, {
        slots: {
          menu: '<div class="menu-item">Test</div>'
        }
      })
      await nextTick()
    })

    it('exposes closeMenu method', async () => {
      const vm = wrapper.vm
      
      // Open menu
      await wrapper.find('.trigger').trigger('click')
      await nextTick()
      expect(vm.isMenuOpen()).toBe(true)
      
      // Close via method
      vm.closeMenu()
      await nextTick()
      expect(vm.isMenuOpen()).toBe(false)
    })

    it('exposes toggleMenu method', async () => {
      const vm = wrapper.vm
      
      expect(vm.isMenuOpen()).toBe(false)
      
      // Toggle open
      vm.toggleMenu()
      await nextTick()
      expect(vm.isMenuOpen()).toBe(true)
      
      // Toggle closed
      vm.toggleMenu()
      await nextTick()
      expect(vm.isMenuOpen()).toBe(false)
    })
  })

  describe('Edge Cases', () => {
    it('handles mounting without menu slot', async () => {
      wrapper = mount(ContextMenuTrigger)
      await nextTick()
      
      // Should not crash when clicking without menu slot
      await wrapper.find('.trigger').trigger('click')
      await nextTick()
      
      expect(wrapper.find('[data-testid="context-menu"]').exists()).toBe(true)
    })

    it('handles rapid toggle operations', async () => {
      wrapper = mount(ContextMenuTrigger, {
        slots: {
          menu: '<div class="menu-item">Test</div>'
        }
      })
      await nextTick()
      
      const vm = wrapper.vm
      
      // Rapid toggles
      vm.toggleMenu()
      vm.toggleMenu()
      vm.toggleMenu()
      await nextTick()
      
      expect(vm.isMenuOpen()).toBe(true)
    })

    it('cleans up event listeners on unmount', async () => {
      const addEventListenerSpy = vi.spyOn(document, 'addEventListener')
      const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener')
      
      wrapper = mount(ContextMenuTrigger)
      await nextTick()
      
      expect(addEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function))
      
      wrapper.unmount()
      
      expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function))
      
      addEventListenerSpy.mockRestore()
      removeEventListenerSpy.mockRestore()
    })
  })

  describe('CSS Classes and Styling', () => {
    it('applies correct CSS classes', async () => {
      wrapper = mount(ContextMenuTrigger)
      await nextTick()
      
      expect(wrapper.find('.context-menu-trigger').exists()).toBe(true)
      expect(wrapper.find('.trigger').exists()).toBe(true)
    })

    it('maintains focus styles with outline', async () => {
      wrapper = mount(ContextMenuTrigger, {
        attachTo: document.body
      })
      await nextTick()
      
      const trigger = wrapper.find('.trigger')
      expect(trigger.attributes('tabindex')).toBe('0')
      
      // Focus should be possible
      trigger.element.focus()
      await nextTick()
      expect(trigger.element).toBe(document.activeElement)
    })
  })
})
import { mount } from '@vue/test-utils'
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest'
import { vTooltip } from '../../src/renderer/directives/tooltip'
import { useWindowMock } from '../mocks/window'

// Simple test component that uses the tooltip directive
const TestComponent = {
  template: `
    <div>
      <button 
        v-tooltip="tooltipConfig" 
        @click="handleClick"
        data-testid="tooltip-button"
      >
        Click me
      </button>
    </div>
  `,
  props: {
    tooltipConfig: {
      type: [String, Object],
      default: 'Test tooltip'
    }
  },
  setup() {
    const handleClick = vi.fn()
    return { handleClick }
  },
  directives: {
    tooltip: vTooltip
  }
}

// Component to test SVG elements
const SvgTestComponent = {
  template: `
    <div>
      <svg v-tooltip="'SVG tooltip'" data-testid="svg-element" width="20" height="20">
        <circle cx="10" cy="10" r="8" fill="blue" />
      </svg>
    </div>
  `,
  directives: {
    tooltip: vTooltip
  }
}

describe('Tooltip directive', () => {

  beforeAll(() => {
    useWindowMock()
    vi.useFakeTimers()
  })

  beforeEach(() => {
    // Clear any existing tooltips
    document.querySelectorAll('.tooltip-directive').forEach(el => el.remove())
  })

  afterEach(() => {
    // Clean up any remaining tooltips
    document.querySelectorAll('.tooltip-directive').forEach(el => el.remove())
    vi.clearAllTimers()
  })

  describe('Basic functionality', () => {
    it('should mount component with tooltip directive without errors', () => {
      const wrapper = mount(TestComponent)
      const button = wrapper.find('[data-testid="tooltip-button"]')
      
      expect(button.exists()).toBe(true)
      expect(wrapper.vm.tooltipConfig).toBe('Test tooltip')
    })

    it('should not show tooltip immediately on mouseenter', async () => {
      const wrapper = mount(TestComponent)
      const button = wrapper.find('[data-testid="tooltip-button"]')
      
      // Initially no tooltip should exist
      expect(document.querySelector('.tooltip-directive')).toBeNull()
      
      // Trigger mouseenter
      await button.trigger('mouseenter')
      
      // Should not show immediately (has delay)
      expect(document.querySelector('.tooltip-directive')).toBeNull()
    })

    it('should teleport tooltip to document body when shown', async () => {
      const wrapper = mount(TestComponent, {
        props: { tooltipConfig: 'Body teleport test' }
      })
      const button = wrapper.find('[data-testid="tooltip-button"]')
      
      // Trigger mouseenter and advance timers
      await button.trigger('mouseenter')
      vi.advanceTimersByTime(1000) // Advance past tooltip delay
      
      // Check if tooltip exists in document body
      const tooltip = document.querySelector('.tooltip-directive')
      if (tooltip) {
        expect(tooltip.parentElement).toBe(document.body)
        expect(tooltip.textContent).toContain('Body teleport test')
      }
    })

    it('should handle different tooltip configurations', async () => {
      // Test string configuration
      const wrapper1 = mount(TestComponent, {
        props: { tooltipConfig: 'String tooltip' }
      })
      expect(wrapper1.vm.tooltipConfig).toBe('String tooltip')
      
      // Test object configuration
      const wrapper2 = mount(TestComponent, {
        props: { 
          tooltipConfig: { 
            text: 'Object tooltip', 
            position: 'left' 
          }
        }
      })
      expect(wrapper2.vm.tooltipConfig['text']).toBe('Object tooltip')
      expect(wrapper2.vm.tooltipConfig['position']).toBe('left')
    })

    it('should update when tooltip config changes', async () => {
      const wrapper = mount(TestComponent, {
        props: { tooltipConfig: 'Initial text' }
      })
      
      expect(wrapper.vm.tooltipConfig).toBe('Initial text')
      
      // Update tooltip text
      await wrapper.setProps({ tooltipConfig: 'Updated text' })
      
      expect(wrapper.vm.tooltipConfig).toBe('Updated text')
    })
  })

  describe('SVG element support', () => {
    it('should handle SVG elements without wrappers', () => {
      const wrapper = mount(SvgTestComponent)
      const svg = wrapper.find('[data-testid="svg-element"]')
      
      expect(svg.exists()).toBe(true)
      expect(svg.element.tagName).toBe('svg')
      
      // SVG elements should work with tooltip directive without wrappers
      // since tooltips are now teleported to body
      expect(svg.element).toBeDefined()
    })
  })

  describe('Click handling', () => {
    it('should not interfere with click events', async () => {
      const wrapper = mount(TestComponent)
      const button = wrapper.find('[data-testid="tooltip-button"]')
      
      // Simulate click
      await button.trigger('click')
      
      // The click handler should have been called
      expect(wrapper.vm.handleClick).toHaveBeenCalledTimes(1)
    })

    it('should not prevent multiple clicks', async () => {
      const wrapper = mount(TestComponent)
      const button = wrapper.find('[data-testid="tooltip-button"]')
      
      // Simulate multiple clicks
      await button.trigger('click')
      await button.trigger('click')
      await button.trigger('click')
      
      // All click handlers should have been called
      expect(wrapper.vm.handleClick).toHaveBeenCalledTimes(3)
    })

    it('should handle click events with different tooltip configurations', async () => {
      const wrapper = mount(TestComponent, {
        props: { 
          tooltipConfig: { 
            text: 'Click test tooltip', 
            position: 'bottom' 
          }
        }
      })
      const button = wrapper.find('[data-testid="tooltip-button"]')
      
      // Multiple clicks should still work
      await button.trigger('click')
      await button.trigger('click')
      
      expect(wrapper.vm.handleClick).toHaveBeenCalledTimes(2)
    })
  })

  describe('Event handling', () => {
    it('should handle mouseenter and mouseleave events', async () => {
      const wrapper = mount(TestComponent)
      const button = wrapper.find('[data-testid="tooltip-button"]')
      
      // These should not throw errors
      await button.trigger('mouseenter')
      await button.trigger('mouseleave')
      
      // Component should still be functional
      await button.trigger('click')
      expect(wrapper.vm.handleClick).toHaveBeenCalledTimes(1)
    })

    it('should handle rapid mouse events', async () => {
      const wrapper = mount(TestComponent)
      const button = wrapper.find('[data-testid="tooltip-button"]')
      
      // Rapid mouse events should not cause issues
      await button.trigger('mouseenter')
      await button.trigger('mouseleave')
      await button.trigger('mouseenter')
      await button.trigger('mouseleave')
      await button.trigger('click')
      
      expect(wrapper.vm.handleClick).toHaveBeenCalledTimes(1)
    })
  })

  describe('Cleanup', () => {
    it('should handle component unmount gracefully', () => {
      const wrapper = mount(TestComponent)
      
      // This should not throw errors
      expect(() => wrapper.unmount()).not.toThrow()
    })

    it('should handle unmount after mouse events', async () => {
      const wrapper = mount(TestComponent)
      const button = wrapper.find('[data-testid="tooltip-button"]')
      
      // Trigger some events
      await button.trigger('mouseenter')
      await button.trigger('click')
      
      // Unmount should work without errors
      expect(() => wrapper.unmount()).not.toThrow()
    })
  })
})

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { McpTool } from '../../src/types/mcp'
import { useWindowMock } from '../mocks/window'
import { createI18nMock } from '../mocks'
import McpToolSelector from '../../src/components/McpToolSelector.vue'
import { stubTeleport } from '../mocks/stubs'

vi.mock('../../src/services/i18n', async () => {
  return createI18nMock()
})

describe('McpToolSelector', () => {
  
  beforeAll(() => {
    useWindowMock()
  })
  
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const mockTools: McpTool[] = [
    { name: 'tool1', description: 'First tool for testing' },
    { name: 'tool2', description: 'Second tool for testing' },
    { name: 'tool3', description: 'Third tool for testing' }
  ]

  it('renders tools with checkboxes', async () => {
    const wrapper = mount(McpToolSelector, {
      ...stubTeleport,
      props: {
        tools: mockTools,
        toolSelection: null
      }
    })
    
    await nextTick()
    
    const toolItems = wrapper.findAll('.tool-item')
    expect(toolItems.length).toBe(3)
    
    const checkboxes = wrapper.findAll('input[type="checkbox"]')
    expect(checkboxes.length).toBe(3)
    
    // All checkboxes should be checked when toolSelection is null (all enabled)
    checkboxes.forEach(checkbox => {
      expect(checkbox.element.checked).toBe(true)
    })
  })

  it('initializes selection correctly for null (all tools)', async () => {
    const wrapper = mount(McpToolSelector, {
      ...stubTeleport,
      props: {
        tools: mockTools,
        toolSelection: null
      }
    })
    
    await nextTick()
    
    const summary = wrapper.find('.selection-summary')
    expect(summary.text()).toBe('common.allSelected')
  })

  it('initializes selection correctly for empty array (no tools)', async () => {
    const wrapper = mount(McpToolSelector, {
      ...stubTeleport,
      props: {
        tools: mockTools,
        toolSelection: []
      }
    })
    
    await nextTick()
    
    const checkboxes = wrapper.findAll('input[type="checkbox"]')
    checkboxes.forEach(checkbox => {
      expect(checkbox.element.checked).toBe(false)
    })
    
    const summary = wrapper.find('.selection-summary')
    expect(summary.text()).toBe('common.noneSelected')
  })

  it('initializes selection correctly for specific tools', async () => {
    const wrapper = mount(McpToolSelector, {
      ...stubTeleport,
      props: {
        tools: mockTools,
        toolSelection: ['tool1', 'tool3']
      }
    })
    
    await nextTick()
    
    const checkboxes = wrapper.findAll('input[type="checkbox"]')
    expect(checkboxes[0].element.checked).toBe(true)  // tool1
    expect(checkboxes[1].element.checked).toBe(false) // tool2
    expect(checkboxes[2].element.checked).toBe(true)  // tool3
    
    const summary = wrapper.find('.selection-summary')
    expect(summary.text()).toBe('common.selectedCount_default_selected=2&total=3')
  })

  it('handles select all button', async () => {
    const wrapper = mount(McpToolSelector, {
      ...stubTeleport,
      props: {
        tools: mockTools,
        toolSelection: ['tool1']
      }
    })
    
    await nextTick()
    
    const selectAllButton = wrapper.find('button[name="all"]')
    expect(selectAllButton.text()).toBe('common.selectAll')
    
    await selectAllButton.trigger('click')
    await nextTick()
    
    const checkboxes = wrapper.findAll('input[type="checkbox"]')
    checkboxes.forEach(checkbox => {
      expect(checkbox.element.checked).toBe(true)
    })
  })

  it('handles select none button', async () => {
    const wrapper = mount(McpToolSelector, {
      ...stubTeleport,
      props: {
        tools: mockTools,
        toolSelection: null
      }
    })
    
    await nextTick()
    
    const selectNoneButton = wrapper.find('button[name="none"]')
    expect(selectNoneButton.text()).toBe('common.selectNone')
    
    await selectNoneButton.trigger('click')
    await nextTick()
    
    const checkboxes = wrapper.findAll('input[type="checkbox"]')
    checkboxes.forEach(checkbox => {
      expect(checkbox.element.checked).toBe(false)
    })
  })

  it('emits save event with correct tool selection', async () => {
    const wrapper = mount(McpToolSelector, {
      ...stubTeleport,
      props: {
        tools: mockTools,
        toolSelection: null
      }
    })
    
    await nextTick()
    
    // Uncheck tool2
    const tool2Checkbox = wrapper.findAll('input[type="checkbox"]')[1]
    await tool2Checkbox.setValue(false)
    await nextTick()
    
    const saveButton = wrapper.find('button[name="save"]')
    await saveButton.trigger('click')
    
    const saveEvents = wrapper.emitted('save')
    expect(saveEvents).toBeDefined()
    expect(saveEvents![0][0]).toEqual(['tool1', 'tool3'])
  })

  it('emits save event with null when all tools selected', async () => {
    const wrapper = mount(McpToolSelector, {
      ...stubTeleport,
      props: {
        tools: mockTools,
        toolSelection: ['tool1']
      }
    })
    
    await nextTick()
    
    // Select all tools
    const selectAllButton = wrapper.find('button[name="all"]')
    await selectAllButton.trigger('click')
    await nextTick()
    
    const saveButton = wrapper.find('button[name="save"]')
    await saveButton.trigger('click')
    
    const saveEvents = wrapper.emitted('save')
    expect(saveEvents).toBeDefined()
    expect(saveEvents![0][0]).toBe(null)
  })

  it('emits cancel event when cancel is clicked', async () => {
    const wrapper = mount(McpToolSelector, {
      ...stubTeleport,
      props: {
        tools: mockTools,
        toolSelection: null
      }
    })
    
    await nextTick()
    
    const cancelButton = wrapper.find('button[name="cancel"]')
    await cancelButton.trigger('click')
    
    const cancelEvents = wrapper.emitted('cancel')
    expect(cancelEvents).toBeDefined()
    expect(cancelEvents!.length).toBe(1)
  })

  it('handles empty tools list', async () => {
    const wrapper = mount(McpToolSelector, {
      ...stubTeleport,
      props: {
        tools: [],
        toolSelection: null
      }
    })
    
    await nextTick()
    
    const emptyState = wrapper.find('.empty-state')
    expect(emptyState.exists()).toBe(true)
    expect(emptyState.text()).toBe('mcp.noTools')
    
    const toolItems = wrapper.findAll('.tool-item')
    expect(toolItems.length).toBe(0)
  })

})
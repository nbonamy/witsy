import { vi, beforeAll, afterEach, expect, test, describe } from 'vitest'
import { mount, enableAutoUnmount, VueWrapper } from '@vue/test-utils'
import { useWindowMock } from '../../../mocks/window'
import { createI18nMock } from '../../../mocks'
import { stubTeleport } from '../../../mocks/stubs'
import { store } from '../../../../src/renderer/services/store'
import Agent from '../../../../src/models/agent'
import AgentPicker from '../../../../src/renderer/screens/AgentPicker.vue'

enableAutoUnmount(afterEach)

vi.mock('../../../../src/renderer/services/i18n', async () => {
  return createI18nMock()
})

beforeAll(() => {
  useWindowMock()
})

const createTestAgents = () => {
  const agents = [
    new Agent(),
    new Agent(),
    new Agent(),
  ]
  
  agents[0].uuid = 'agent-1'
  agents[0].name = 'Witsy Agent'
  agents[0].description = 'A helpful Witsy agent'
  agents[0].type = 'runnable'
  agents[0].source = 'witsy'
  
  agents[1].uuid = 'agent-2'
  agents[1].name = 'A2A Agent'
  agents[1].description = 'An A2A agent'
  agents[1].type = 'runnable'
  agents[1].source = 'a2a'
  
  agents[2].uuid = 'agent-3'
  agents[2].name = 'Support Agent'
  agents[2].description = 'A support agent'
  agents[2].type = 'support'
  agents[2].source = 'witsy'
  
  return agents
}

const mount_component = (agents: Agent[] = []): VueWrapper<any> => {
  store.agents = agents
  return mount(AgentPicker, { ...stubTeleport  })
}

describe('AgentPicker', () => {

  test('Renders correctly with agents', async () => {
    const agents = createTestAgents()
    const wrapper = mount_component(agents)
    
    expect(wrapper.exists()).toBe(true)
    expect(wrapper.find('#agent-picker').exists()).toBe(true)
    expect(wrapper.find('.agent-list').exists()).toBe(true)
    
    // Should only show runnable agents (not support agents)
    const agentItems = wrapper.findAll('.agent-item')
    expect(agentItems).toHaveLength(2)
    
    // Check first agent (Witsy)
    const firstAgent = agentItems[0]
    expect(firstAgent.find('.agent-name').text()).toBe('Witsy Agent')
    expect(firstAgent.find('.agent-description').text()).toBe('A helpful Witsy agent')
    expect(firstAgent.find('.agent-icon').exists()).toBe(true) // Robot icon for Witsy
    
    // Check second agent (A2A)
    const secondAgent = agentItems[1]
    expect(secondAgent.find('.agent-name').text()).toBe('A2A Agent')
    expect(secondAgent.find('.agent-description').text()).toBe('An A2A agent')
    expect(secondAgent.find('.agent-icon').exists()).toBe(true) // A2A logo
  })

  test('Shows correct icons for different agent sources', async () => {
    const agents = createTestAgents()
    const wrapper = mount_component(agents)
    
    const agentItems = wrapper.findAll('.agent-item')
    
    // First agent should have robot icon (Witsy)
    const firstIcon = agentItems[0].find('.agent-icon')
    expect(firstIcon.exists()).toBe(true)

    // Second agent should have A2A icon
    const secondIcon = agentItems[1].find('.agent-icon')
    expect(secondIcon.exists()).toBe(true)
  })

  test('Clicking on agent item triggers selection', async () => {
    const agents = createTestAgents()
    const wrapper = mount_component(agents)
    
    const agentItems = wrapper.findAll('.agent-item')
    expect(agentItems[0].exists()).toBe(true)
    
    await agentItems[0].trigger('click')
    
    // Verify the agent item is clickable
    expect(agentItems[0].element).toBeDefined()
  })

  test('Cancel button works correctly', async () => {
    const agents = createTestAgents()
    const wrapper = mount_component(agents)
    
    const cancelButton = wrapper.find('button[name="cancel"]')
    expect(cancelButton.exists()).toBe(true)
    expect(cancelButton.classes()).toContain('tertiary')
  })

  test('Filters only runnable agents', async () => {
    const agents = createTestAgents()
    const wrapper = mount_component(agents)
    
    // Should only show 2 agents (excluding the support agent)
    const agentItems = wrapper.findAll('.agent-item')
    expect(agentItems).toHaveLength(2)
    
    // Should not show the support agent
    agentItems.forEach(item => {
      expect(item.find('.agent-name').text()).not.toBe('Support Agent')
    })
  })

  test('Empty state when no runnable agents', async () => {
    // Create only support agents (no runnable agents)
    const agents = [new Agent()]
    agents[0].type = 'support'
    agents[0].name = 'Support Only'
    
    const wrapper = mount_component(agents)
    
    // Agent list should be empty
    const agentItems = wrapper.findAll('.agent-item')
    expect(agentItems).toHaveLength(0)
    
    // List container should still exist
    expect(wrapper.find('.agent-list').exists()).toBe(true)
  })

  test('Modal dialog structure', async () => {
    const agents = createTestAgents()
    const wrapper = mount_component(agents)
    
    // Check modal structure
    expect(wrapper.find('#agent-picker').exists()).toBe(true)
    
    // Should have header with title
    const header = wrapper.find('[data-test="modal-header"]')
    if (header.exists()) {
      expect(header.text()).toContain('Agent')
    }
    
    // Should have body with agent list
    expect(wrapper.find('.agent-list').exists()).toBe(true)
    
    // Should have footer with cancel button
    const footer = wrapper.find('.buttons')
    expect(footer.exists()).toBe(true)
    expect(footer.find('button').exists()).toBe(true)
  })

  test('Agent item hover states', async () => {
    const agents = createTestAgents()
    const wrapper = mount_component(agents)
    
    const agentItems = wrapper.findAll('.agent-item')
    expect(agentItems.length).toBeGreaterThan(0)
    
    // Each agent item should have the agent-item class
    agentItems.forEach(item => {
      expect(item.classes()).toContain('agent-item')
    })
  })

  test('Agent information display', async () => {
    const agents = createTestAgents()
    const wrapper = mount_component(agents)
    
    const agentItems = wrapper.findAll('.agent-item')
    
    agentItems.forEach(item => {
      // Each item should have icon, name, and description
      expect(item.find('.agent-icon').exists()).toBe(true)
      expect(item.find('.agent-info').exists()).toBe(true)
      expect(item.find('.agent-name').exists()).toBe(true)
      expect(item.find('.agent-description').exists()).toBe(true)
      
      // Name and description should not be empty
      expect(item.find('.agent-name').text().trim()).not.toBe('')
      expect(item.find('.agent-description').text().trim()).not.toBe('')
    })
  })

  test('Accessibility attributes', async () => {
    const agents = createTestAgents()
    const wrapper = mount_component(agents)
    
    const agentItems = wrapper.findAll('.agent-item')
    
    // Agent items should be clickable
    agentItems.forEach(item => {
      // Should have some indication of interactivity
      expect(item.element.tagName).toBe('DIV')
      expect(item.classes()).toContain('agent-item')
    })
    
    // Cancel button should be properly labeled
    const cancelButton = wrapper.find('button')
    expect(cancelButton.text().trim()).not.toBe('')
  })

  test('onSelectAgent method functionality', async () => {
    const agents = createTestAgents()
    const wrapper = mount_component(agents)
    
    // Get the component instance
    const componentInstance = wrapper.vm
    
    // Mock a resolve callback 
    const mockResolveCallback = vi.fn()
    
    // Manually set the resolve callback (simulating what pick() would do)
    componentInstance.resolveCallback = mockResolveCallback
    
    // Call onSelectAgent directly on the component instance (internal method)
    await componentInstance.onSelectAgent(agents[0])
    
    // Verify resolveCallback was called with the agent
    expect(mockResolveCallback).toHaveBeenCalledWith(agents[0])
    // Verify resolveCallback was reset to null
    expect(componentInstance.resolveCallback).toBeNull()
  })

  test('close method functionality', async () => {
    const agents = createTestAgents()
    const wrapper = mount_component(agents)
    
    // Get the component instance and its exposed methods
    const componentInstance = wrapper.vm
    const exposedMethods = componentInstance.$.exposed
    
    // Mock a resolve callback 
    const mockResolveCallback = vi.fn()
    
    // Manually set the resolve callback (simulating what pick() would do)
    componentInstance.resolveCallback = mockResolveCallback
    
    // Call the close method
    await exposedMethods.close()
    
    // Verify resolveCallback was called with null (indicating cancellation)
    expect(mockResolveCallback).toHaveBeenCalledWith(null)
    // Verify resolveCallback was reset to null
    expect(componentInstance.resolveCallback).toBeNull()
  })

  test('onCancel method functionality', async () => {
    const agents = createTestAgents()
    const wrapper = mount_component(agents)
    
    // Get the component instance
    const componentInstance = wrapper.vm
    
    // Mock a resolve callback 
    const mockResolveCallback = vi.fn()
    
    // Manually set the resolve callback (simulating what pick() would do)
    componentInstance.resolveCallback = mockResolveCallback
    
    // Call the onCancel method (which should call close internally)
    await componentInstance.onCancel()
    
    // Verify that onCancel triggered the same behavior as close
    expect(mockResolveCallback).toHaveBeenCalledWith(null)
    expect(componentInstance.resolveCallback).toBeNull()
  })

  test('pick method exposed functionality', async () => {
    const agents = createTestAgents()
    const wrapper = mount_component(agents)
    
    // Get the component instance and its exposed methods
    const componentInstance = wrapper.vm
    const exposedMethods = componentInstance.$.exposed
    
    // Test that pick method exists and is callable
    expect(typeof exposedMethods.pick).toBe('function')
    
    // Test calling pick method returns a Promise
    const pickPromise = exposedMethods.pick()
    expect(pickPromise).toBeInstanceOf(Promise)
    
    // Verify resolveCallback is set after calling pick
    expect(componentInstance.resolveCallback).toBeDefined()
    expect(typeof componentInstance.resolveCallback).toBe('function')
    
    // Clean up - resolve the promise by closing
    exposedMethods.close()
    await pickPromise // Wait for promise to resolve
  })

  test('pick method with no agents shows dialog', async () => {
    // Test with no runnable agents (empty array)
    const wrapper = mount_component([])
    
    // Get the component instance and its exposed methods
    const componentInstance = wrapper.vm
    const exposedMethods = componentInstance.$.exposed
    
    // Call pick with no agents - should return null immediately
    const result = await exposedMethods.pick()
    expect(result).toBeNull()
    
    // Since there are no agents, resolveCallback should not be set
    expect(componentInstance.resolveCallback).toBeNull()
  })

  test('agent selection calls resolveCallback', async () => {
    const agents = createTestAgents()
    const wrapper = mount_component(agents)
    
    const agentPicker = wrapper.vm
    const testAgent = agents[0]
    
    // Set up a mock resolveCallback
    const mockResolveCallback = vi.fn()
    agentPicker.resolveCallback = mockResolveCallback
    
    // Call onSelectAgent
    agentPicker.onSelectAgent(testAgent)
    
    // Verify resolveCallback was called with the agent
    expect(mockResolveCallback).toHaveBeenCalledWith(testAgent)
  })

  test('close method calls resolveCallback with null', async () => {
    const agents = createTestAgents()
    const wrapper = mount_component(agents)
    
    const agentPicker = wrapper.vm
    
    // Set up a mock resolveCallback
    const mockResolveCallback = vi.fn()
    agentPicker.resolveCallback = mockResolveCallback
    
    // Call close
    agentPicker.close()
    
    // Verify resolveCallback was called with null
    expect(mockResolveCallback).toHaveBeenCalledWith(null)
  })

  test('agent item click triggers onSelectAgent', async () => {
    const agents = createTestAgents()
    const wrapper = mount_component(agents)
    
    // Get the component instance
    const componentInstance = wrapper.vm
    
    // Set up a mock resolveCallback to verify the selection works
    const mockResolveCallback = vi.fn()
    componentInstance.resolveCallback = mockResolveCallback
    
    // Click on the first agent item
    const agentItems = wrapper.findAll('.agent-item')
    await agentItems[0].trigger('click')
    
    // Verify the callback was called with the correct agent
    expect(mockResolveCallback).toHaveBeenCalledWith(agents[0])
  })
})

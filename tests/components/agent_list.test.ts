import { vi, beforeAll, beforeEach, afterAll, expect, test } from 'vitest'
import { mount, VueWrapper, enableAutoUnmount } from '@vue/test-utils'
import { useWindowMock } from '../mocks/window'
import { store } from '../../src/services/store'
import List from '../../src/agent/List.vue'

enableAutoUnmount(afterAll)

beforeAll(() => {
  useWindowMock()
  store.loadSettings()
})

beforeEach(() => {
  vi.clearAllMocks()
  store.agents = []
  // Load agents from window mock
  store.loadAgents()
})

test('Renders agent list component', async () => {
  const wrapper: VueWrapper<any> = mount(List, { 
    props: { agents: store.agents } 
  })
  expect(wrapper.exists()).toBe(true)
  expect(wrapper.find('.agents-list')).toBeTruthy()
})

test('Shows runnable and support agent sections', async () => {
  const wrapper: VueWrapper<any> = mount(List, { 
    props: { agents: store.agents } 
  })
  
  const panels = wrapper.findAll('.agents.panel')
  expect(panels).toHaveLength(2)
  
  // Check section headers
  const headers = wrapper.findAll('.panel-header label')
  expect(headers.at(0)?.text()).toBe('agent.forge.list.runnable')
  expect(headers.at(1)?.text()).toBe('agent.forge.list.support')
})

test('Shows agents in correct sections', async () => {
  const wrapper: VueWrapper<any> = mount(List, { 
    props: { agents: store.agents } 
  })
  
  // First section should have runnable agents
  const runnableSection = wrapper.findAll('.agents.panel').at(0)
  const runnableItems = runnableSection?.findAll('.panel-item')
  expect(runnableItems).toHaveLength(2) // agent1 and agent3 are runnable
  
  // Second section should have support agents
  const supportSection = wrapper.findAll('.agents.panel').at(1)
  const supportItems = supportSection?.findAll('.panel-item')
  expect(supportItems).toHaveLength(1) // agent2 is support
})

test('Displays agent information correctly', async () => {
  const wrapper: VueWrapper<any> = mount(List, { 
    props: { agents: store.agents } 
  })
  
  const firstItem = wrapper.find('.panel-item')
  expect(firstItem.find('.text').text()).toBe('Test Agent 1') // Most recently updated
  expect(firstItem.find('.subtext').text()).toBe('A test runnable agent')
})

test('Sorts agents by updated date (newest first)', async () => {
  const wrapper: VueWrapper<any> = mount(List, { 
    props: { agents: store.agents } 
  })
  
  const runnableSection = wrapper.findAll('.agents.panel').at(0)
  const runnableItems = runnableSection?.findAll('.panel-item .text')
  
  // Should be sorted by updatedAt descending (newest first)
  expect(runnableItems?.at(0)?.text()).toBe('Test Agent 1') // Most recent
  expect(runnableItems?.at(1)?.text()).toBe('Test Agent 3') // Older
})

test('Shows empty message when no agents', async () => {
  const wrapper: VueWrapper<any> = mount(List, { 
    props: { agents: [] } 
  })
  
  const emptyMessages = wrapper.findAll('.panel-empty')
  expect(emptyMessages).toHaveLength(2) // One for each section
  expect(emptyMessages.at(0)?.text()).toBe('agent.forge.list.empty')
  expect(emptyMessages.at(1)?.text()).toBe('agent.forge.list.empty')
})

test('Shows action buttons for each agent', async () => {
  const wrapper: VueWrapper<any> = mount(List, { 
    props: { agents: store.agents } 
  })
  
  const firstItem = wrapper.find('.panel-item')
  const actions = firstItem.find('.actions')
  
  expect(actions.find('.run')).toBeTruthy()
  expect(actions.find('.view')).toBeTruthy()
  expect(actions.find('.edit')).toBeTruthy()
  expect(actions.find('.delete')).toBeTruthy()
})

test('Emits view event when clicking on panel item', async () => {
  const wrapper: VueWrapper<any> = mount(List, { 
    props: { agents: store.agents } 
  })
  
  const firstItem = wrapper.find('.panel-item')
  await firstItem.trigger('click')
  
  expect(wrapper.emitted('view')).toBeTruthy()
  expect(wrapper.emitted('view')![0]).toEqual([store.agents[0]]) // agent1 (most recent)
})

test('Emits run event when clicking run button', async () => {
  const wrapper: VueWrapper<any> = mount(List, { 
    props: { agents: store.agents } 
  })
  
  const runButton = wrapper.find('.run')
  await runButton.trigger('click')
  
  expect(wrapper.emitted('run')).toBeTruthy()
  expect(wrapper.emitted('run')![0]).toEqual([store.agents[0]]) // agent1 (most recent)
})

test('Emits view event when clicking view button', async () => {
  const wrapper: VueWrapper<any> = mount(List, { 
    props: { agents: store.agents } 
  })
  
  const viewButton = wrapper.find('.view')
  await viewButton.trigger('click')
  
  expect(wrapper.emitted('view')).toBeTruthy()
  expect(wrapper.emitted('view')![0]).toEqual([store.agents[0]]) // agent1 (most recent)
})

test('Emits edit event when clicking edit button', async () => {
  const wrapper: VueWrapper<any> = mount(List, { 
    props: { agents: store.agents } 
  })
  
  const editButton = wrapper.find('.edit')
  await editButton.trigger('click')
  
  expect(wrapper.emitted('edit')).toBeTruthy()
  expect(wrapper.emitted('edit')![0]).toEqual([store.agents[0]]) // agent1 (most recent)
})

test('Emits delete event when clicking delete button', async () => {
  const wrapper: VueWrapper<any> = mount(List, { 
    props: { agents: store.agents } 
  })
  
  const deleteButton = wrapper.find('.delete')
  await deleteButton.trigger('click')
  
  expect(wrapper.emitted('delete')).toBeTruthy()
  expect(wrapper.emitted('delete')![0]).toEqual([store.agents[0]]) // agent1 (most recent)
})

test('Emits create event when clicking create button', async () => {
  const wrapper: VueWrapper<any> = mount(List, { 
    props: { agents: store.agents } 
  })
  
  const createButton = wrapper.find('.create')
  await createButton.trigger('click')
  
  expect(wrapper.emitted('create')).toBeTruthy()
  expect(wrapper.emitted('create')![0]).toEqual(['runnable']) // First section is runnable
})

test('Emits importA2A event when clicking A2A button', async () => {
  const wrapper: VueWrapper<any> = mount(List, { 
    props: { agents: store.agents } 
  })
  
  const a2aButton = wrapper.find('.a2a')
  await a2aButton.trigger('click')
  
  expect(wrapper.emitted('importA2A')).toBeTruthy()
  expect(wrapper.emitted('importA2A')![0]).toEqual(['runnable']) // First section is runnable
})

test('Event handlers prevent bubbling for action buttons', async () => {
  const wrapper: VueWrapper<any> = mount(List, { 
    props: { agents: store.agents } 
  })
  
  // Click on run button should not trigger the panel item click
  const runButton = wrapper.find('.run')
  await runButton.trigger('click')
  
  // Should have run event but not view event from panel item
  expect(wrapper.emitted('run')).toBeTruthy()
  expect(wrapper.emitted('view')).toBeFalsy()
})

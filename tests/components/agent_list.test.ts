import { vi, beforeAll, beforeEach, afterAll, expect, test } from 'vitest'
import { mount, VueWrapper, enableAutoUnmount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { useWindowMock } from '../mocks/window'
import { store } from '../../src/services/store'
import List from '../../src/agent/List.vue'

// Mock the i18n service
vi.mock('../../src/services/i18n', () => ({
  t: (key: string) => key
}))

// Mock the ContextMenuPlus component
vi.mock('../../src/components/ContextMenuPlus.vue', () => ({
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

test('Shows table with agent rows', async () => {
  const wrapper: VueWrapper<any> = mount(List, { 
    props: { agents: store.agents } 
  })
  
  const table = wrapper.find('table')
  expect(table.exists()).toBe(true)
  
  // Check table headers
  const headers = wrapper.findAll('thead th')
  expect(headers).toHaveLength(5)
  expect(headers.at(0)?.text()).toBe('agent.name')
  expect(headers.at(1)?.text()).toBe('agent.description')
  expect(headers.at(2)?.text()).toBe('common.type')
  expect(headers.at(3)?.text()).toBe('agent.history.lastRun')
  expect(headers.at(4)?.text()).toBe('common.actions')
})

test('Shows all agents in table rows', async () => {
  const wrapper: VueWrapper<any> = mount(List, { 
    props: { agents: store.agents } 
  })
  
  // Should have all 3 agents in table rows
  const rows = wrapper.findAll('tbody tr')
  expect(rows).toHaveLength(3) // agent1, agent2, and agent3
})

test('Displays agent information correctly', async () => {
  const wrapper: VueWrapper<any> = mount(List, { 
    props: { agents: store.agents } 
  })
  
  const firstRow = wrapper.find('tbody tr')
  const cells = firstRow.findAll('td')
  
  // Should display agent name, type, and last run info
  expect(cells.at(0)?.text()).toBe('Test Agent 1')
  expect(cells.at(1)?.text()).toBe('A test runnable agent')
  expect(cells.at(2)?.text()).toBe('agent.forge.list.runnable')
  expect(cells.at(3)?.text()).toBeTruthy() // Should have some last run text
})

test('Displays agents in array order', async () => {
  const wrapper: VueWrapper<any> = mount(List, { 
    props: { agents: store.agents } 
  })
  
  const rows = wrapper.findAll('tbody tr')
  const firstRowCells = rows.at(0)?.findAll('td')
  const secondRowCells = rows.at(1)?.findAll('td')
  
  // Should display agents in the order they are passed in the array
  expect(firstRowCells?.at(0)?.text()).toBe('Test Agent 1') 
  expect(secondRowCells?.at(0)?.text()).toBe('Test Agent 2')
})

test('Shows empty table when no agents', async () => {
  const wrapper: VueWrapper<any> = mount(List, { 
    props: { agents: [] } 
  })
  
  const table = wrapper.find('table')
  expect(table.exists()).toBe(true)
  
  const rows = wrapper.findAll('tbody tr')
  expect(rows).toHaveLength(0) // No agent rows
})

test('Shows action buttons for each agent', async () => {
  const wrapper: VueWrapper<any> = mount(List, { 
    props: { agents: store.agents } 
  })
  
  const firstRow = wrapper.find('tbody tr')
  const actionsCell = firstRow.findAll('td').at(4) // Last column contains actions
  const actions = actionsCell?.find('.actions')
  
  expect(actions?.find('.run')).toBeTruthy()
  expect(actions?.find('.view')).toBeTruthy()
  expect(actions?.findComponent({ name: 'ContextMenuTrigger' })).toBeTruthy()
})

test('Emits view event when clicking view button', async () => {
  const wrapper: VueWrapper<any> = mount(List, { 
    props: { agents: store.agents } 
  })
  
  const viewButton = wrapper.find('.view')
  await viewButton.trigger('click')
  
  expect(wrapper.emitted('view')).toBeTruthy()
  expect(wrapper.emitted('view')![0]).toEqual([store.agents[0]]) // First agent in array
})

test('Emits run event when clicking run button', async () => {
  const wrapper: VueWrapper<any> = mount(List, { 
    props: { agents: store.agents } 
  })
  
  const runButton = wrapper.find('.run')
  await runButton.trigger('click')
  
  expect(wrapper.emitted('run')).toBeTruthy()
  expect(wrapper.emitted('run')![0]).toEqual([store.agents[0]]) // First agent in array
})

test('Emits edit event when clicking edit option in context menu', async () => {
  const wrapper: VueWrapper<any> = mount(List, {
    props: { agents: store.agents },
    attachTo: document.body
  })

  // Find the ContextMenuTrigger and click it to open the menu
  const contextMenuTrigger = wrapper.findComponent({ name: 'ContextMenuTrigger' })
  await contextMenuTrigger.find('.trigger').trigger('click')
  await nextTick()

  // Find the ContextMenuPlus component and click the edit item
  const contextMenuPlus = wrapper.findComponent({ name: 'ContextMenuPlus' })
  expect(contextMenuPlus.exists()).toBe(true)

  const editItem = contextMenuPlus.find('.item.edit')
  await editItem.trigger('click')

  expect(wrapper.emitted('edit')).toBeTruthy()
  expect(wrapper.emitted('edit')![0]).toEqual([store.agents[0]]) // First agent in array
})

test('Emits delete event when clicking delete option in context menu', async () => {
  const wrapper: VueWrapper<any> = mount(List, {
    props: { agents: store.agents },
    attachTo: document.body
  })

  // Find the ContextMenuTrigger and click it to open the menu
  const contextMenuTrigger = wrapper.findComponent({ name: 'ContextMenuTrigger' })
  await contextMenuTrigger.find('.trigger').trigger('click')
  await nextTick()

  // Find the ContextMenuPlus component and click the delete item
  const contextMenuPlus = wrapper.findComponent({ name: 'ContextMenuPlus' })
  expect(contextMenuPlus.exists()).toBe(true)

  const deleteItem = contextMenuPlus.find('.item.delete')
  await deleteItem.trigger('click')

  expect(wrapper.emitted('delete')).toBeTruthy()
  expect(wrapper.emitted('delete')![0]).toEqual([store.agents[0]]) // First agent in array
})

test('Emits create event when clicking create button', async () => {
  const wrapper: VueWrapper<any> = mount(List, {
    props: { agents: store.agents }
  })

  const createButton = wrapper.find('button[name="create"]')
  await createButton.trigger('click')

  expect(wrapper.emitted('create')).toBeTruthy()
})

test('Emits importA2A event when clicking A2A button', async () => {
  const wrapper: VueWrapper<any> = mount(List, {
    props: { agents: store.agents }
  })

  const a2aButton = wrapper.find('button[name="import-a2a"]')
  await a2aButton.trigger('click')

  expect(wrapper.emitted('importA2A')).toBeTruthy()
})

test('Emits importJson event when clicking import button', async () => {
  const wrapper: VueWrapper<any> = mount(List, {
    props: { agents: store.agents }
  })

  const importButton = wrapper.find('button[name="import-json"]')
  await importButton.trigger('click')

  expect(wrapper.emitted('importJson')).toBeTruthy()
})

test('Emits export event when clicking export option in context menu', async () => {
  const wrapper: VueWrapper<any> = mount(List, {
    props: { agents: store.agents },
    attachTo: document.body
  })

  // Find the ContextMenuTrigger and click it to open the menu
  const contextMenuTrigger = wrapper.findComponent({ name: 'ContextMenuTrigger' })
  await contextMenuTrigger.find('.trigger').trigger('click')
  await nextTick()

  // Find the ContextMenuPlus component and click the export item
  const contextMenuPlus = wrapper.findComponent({ name: 'ContextMenuPlus' })
  expect(contextMenuPlus.exists()).toBe(true)

  const exportItem = contextMenuPlus.find('.item.export')
  await exportItem.trigger('click')

  expect(wrapper.emitted('export')).toBeTruthy()
  expect(wrapper.emitted('export')![0]).toEqual([store.agents[0]]) // First agent in array
})

test('Event handlers prevent bubbling for action buttons', async () => {
  const wrapper: VueWrapper<any> = mount(List, {
    props: { agents: store.agents }
  })

  // Click on run button should not trigger any other events since there's no panel item click
  const runButton = wrapper.find('.run')
  await runButton.trigger('click')

  // Should have run event only
  expect(wrapper.emitted('run')).toBeTruthy()
  expect(wrapper.emitted('view')).toBeFalsy()
})

import { vi, beforeAll, beforeEach, afterAll, expect, test } from 'vitest'
import { mount, VueWrapper, enableAutoUnmount } from '@vue/test-utils'
import { createI18nMock } from '@tests/mocks/index'
import { useWindowMock } from '@tests/mocks/window'
import { store } from '@services/store'
import { kDefaultWorkspaceId } from '@/consts'
import View from '@renderer/agent/View.vue'
import { nextTick } from 'vue'
import useEventBus from '@composables/event_bus'

const { emitEvent } = useEventBus()

enableAutoUnmount(afterAll)

vi.mock('@services/i18n', async () => {
  return createI18nMock()
})

beforeAll(() => {
  useWindowMock()
  store.loadSettings()
})

beforeEach(() => {
  vi.clearAllMocks()
  store.loadAgents()
})

test('Renders view component with agent', async () => {
  const agent = store.agents[0] // agent1 with mock runs
  const wrapper: VueWrapper<any> = mount(View, {
    props: { agent }
  })
  await nextTick()

  expect(wrapper.exists()).toBe(true)
  expect(wrapper.find('.agent-view')).toBeTruthy()
  expect(wrapper.find('.master-main')).toBeTruthy()
  expect(wrapper.find('.master-detail')).toBeTruthy()
})

test('Does not render when no agent provided', async () => {
  const wrapper: VueWrapper<any> = mount(View, {
    props: { agent: undefined }
  })

  expect(wrapper.find('.agent-view').exists()).toBe(false)
})

test('Renders Info component with correct props', async () => {
  const agent = store.agents[0]
  const wrapper: VueWrapper<any> = mount(View, {
    props: { agent }
  })
  await nextTick()

  const infoComponent = wrapper.findComponent({ name: 'Info' })
  expect(infoComponent.exists()).toBe(true)
  expect(infoComponent.props('agent')).toEqual(agent)
  expect(infoComponent.props('runs')).toHaveLength(3) // Mock runs for agent1

  // Check Info component renders correctly
  expect(infoComponent.find('.agent-info').exists()).toBe(true)
  expect(infoComponent.find('.run').exists()).toBe(true)
  expect(infoComponent.find('.edit').exists()).toBe(true)
  expect(infoComponent.find('.delete').exists()).toBe(true)
})

test('Renders History component with correct props', async () => {
  const agent = store.agents[0]
  const wrapper: VueWrapper<any> = mount(View, {
    props: { agent }
  })
  await nextTick()

  const historyComponent = wrapper.findComponent({ name: 'History' })
  expect(historyComponent.exists()).toBe(true)
  expect(historyComponent.props('agent')).toEqual(agent)
  expect(historyComponent.props('runs')).toHaveLength(3)
  expect(historyComponent.props('showWorkflows')).toBe('exclude')

  // Check History component renders correctly
  expect(historyComponent.find('.runs').exists()).toBe(true)
  expect(historyComponent.find('.history-filter').exists()).toBe(true)
  expect(historyComponent.find('.clear').exists()).toBe(true)
})

test('Loads runs on agent change', async () => {
  const agent = store.agents[0]
  const wrapper: VueWrapper<any> = mount(View, {
    props: { agent: undefined }
  })
  await nextTick()

  // Initially no agent, so no History component should be rendered
  expect(wrapper.find('.agent-view').exists()).toBe(false)

  await wrapper.setProps({ agent })
  await nextTick()

  // After agent is set, History component should show runs
  const historyComponent = wrapper.findComponent({ name: 'History' })
  expect(historyComponent.exists()).toBe(true)
  
  // Check that History component has table rows (excluding spacer row)
  const tableRows = historyComponent.findAll('tbody tr:not(.spacer)')
  expect(tableRows.length).toBeGreaterThan(0) // Should have some runs
})

test('Auto-selects latest run on load (excluding workflows)', async () => {
  const agent = store.agents[0]
  const wrapper: VueWrapper<any> = mount(View, {
    props: { agent }
  })
  await nextTick()

  // Check that History component shows 'exclude' in filter
  const historyComponent = wrapper.findComponent({ name: 'History' })
  const filterSelect = historyComponent.find<HTMLSelectElement>('.history-filter')
  expect(filterSelect.element.value).toBe('exclude')
  
  // Check that a Run component is displayed (meaning a run was auto-selected)
  const runComponent = wrapper.findComponent({ name: 'Run' })
  expect(runComponent.exists()).toBe(true)
  expect(runComponent.props('agentId')).toBe(agent.uuid)
})

test('Shows Run component when run is selected', async () => {
  const agent = store.agents[0]
  const wrapper: VueWrapper<any> = mount(View, {
    props: { agent }
  })
  await nextTick()

  const runComponent = wrapper.findComponent({ name: 'Run' })
  expect(runComponent.exists()).toBe(true)
  expect(runComponent.props('agentId')).toBe(agent.uuid)
  expect(runComponent.props('runId')).toBe('run3')

  // Check Run component renders correctly
  expect(runComponent.find('.run').exists()).toBe(true)
  expect(runComponent.find('.delete').exists()).toBe(true)
})

test('Shows empty state when no run selected', async () => {
  const agent = store.agents[2] // agent3 has no runs
  const wrapper: VueWrapper<any> = mount(View, {
    props: { agent }
  })
  await nextTick()

  expect(wrapper.findComponent({ name: 'Run' }).exists()).toBe(false)
  expect(wrapper.find('.no-run').exists()).toBe(true)
  expect(wrapper.find('.empty-state').text()).toBe('agent.run.selectRun')
})

test('Adjusts showWorkflows when only workflow runs exist', async () => {
  const agent = store.agents[1]
  const wrapper: VueWrapper<any> = mount(View, {
    props: { agent }
  })
  await nextTick()

  // Check that History component shows 'all' in filter when only workflow runs exist
  const historyComponent = wrapper.findComponent({ name: 'History' })
  const filterSelect = historyComponent.find<HTMLSelectElement>('.history-filter')
  expect(filterSelect.element.value).toBe('all')
})

test('Emits run event from Info component', async () => {
  const agent = store.agents[0]
  const wrapper: VueWrapper<any> = mount(View, {
    props: { agent }
  })
  await nextTick()

  const infoComponent = wrapper.findComponent({ name: 'Info' })
  await infoComponent.find('.run').trigger('click')

  expect(wrapper.emitted('run')).toBeTruthy()
  expect(wrapper.emitted('run')![0]).toEqual([agent])
})

test('Emits edit event from Info component', async () => {
  const agent = store.agents[0]
  const wrapper: VueWrapper<any> = mount(View, {
    props: { agent }
  })
  await nextTick()

  const infoComponent = wrapper.findComponent({ name: 'Info' })
  await infoComponent.find('.edit').trigger('click')

  expect(wrapper.emitted('edit')).toBeTruthy()
  expect(wrapper.emitted('edit')![0]).toEqual([agent])
})

test('Emits delete event from Info component', async () => {
  const agent = store.agents[0]
  const wrapper: VueWrapper<any> = mount(View, {
    props: { agent }
  })
  await nextTick()

  const infoComponent = wrapper.findComponent({ name: 'Info' })
  await infoComponent.find('.delete').trigger('click')

  expect(wrapper.emitted('delete')).toBeTruthy()
  expect(wrapper.emitted('delete')![0]).toEqual([agent])
})

test('Selects run when clicked in History component', async () => {
  const agent = store.agents[0]
  const wrapper: VueWrapper<any> = mount(View, {
    props: { agent }
  })
  await nextTick()

  const historyComponent = wrapper.findComponent({ name: 'History' })
  const runRows = historyComponent.findAll('tbody tr')

  // Click on first run row (excluding spacer row)
  if (runRows.length > 1) {
    await runRows[1].trigger('click') // Skip spacer row at index 0
    await nextTick()

    // Check that a Run component is now visible (meaning a run was selected)
    const runComponent = wrapper.findComponent({ name: 'Run' })
    expect(runComponent.exists()).toBe(true)
  }
})

test('Updates showWorkflows when changed in History component', async () => {
  const agent = store.agents[0]
  const wrapper = mount(View, {
    props: { agent }
  })

  await nextTick()

  const historyComponent = wrapper.findComponent({ name: 'History' })
  const filterSelect = historyComponent.find('.history-filter')

  // Get initial value from the History component props
  const initialValue = historyComponent.props('showWorkflows')
  const newValue = initialValue === 'all' ? 'exclude' : 'all'

  await filterSelect.setValue(newValue)
  await nextTick()

  // Check that the History component received the updated prop
  expect(historyComponent.props('showWorkflows')).toBe(newValue)
})

test('Closes run when close button clicked in Run component', async () => {
  const agent = store.agents[0]
  const wrapper: VueWrapper<any> = mount(View, {
    props: { agent }
  })
  await nextTick()

  // Initially a Run component should be visible (auto-selected)
  let runComponent = wrapper.findComponent({ name: 'Run' })
  expect(runComponent.exists()).toBe(true)

  // Simulate clicking the close button - we need to trigger the close event
  await runComponent.vm.$emit('close')
  await nextTick()

  // After closing, no Run component should be visible
  runComponent = wrapper.findComponent({ name: 'Run' })
  expect(runComponent.exists()).toBe(false)
  
  // And the empty state should be shown
  expect(wrapper.find('.no-run').exists()).toBe(true)
})

test('Handles clear history from History component', async () => {
  const agent = store.agents[0]
  const wrapper: VueWrapper<any> = mount(View, {
    props: { agent }
  })
  await nextTick()

  const historyComponent = wrapper.findComponent({ name: 'History' })
  await historyComponent.find('.clear').trigger('click')
  await nextTick()

  // Dialog mock confirms by default, so API should be called
  expect(vi.mocked(window.api.agents.deleteRuns)).toHaveBeenCalledWith(kDefaultWorkspaceId, 'agent1')
})

test('Handles delete run from Run component', async () => {
  const agent = store.agents[0]
  const wrapper: VueWrapper<any> = mount(View, {
    props: { agent }
  })
  await nextTick()

  const runComponent = wrapper.findComponent({ name: 'Run' })
  await runComponent.find('.delete').trigger('click')
  await nextTick()

  // Dialog mock confirms by default, so API should be called
  expect(vi.mocked(window.api.agents.deleteRun)).toHaveBeenCalledWith(kDefaultWorkspaceId, 'agent1', expect.any(String))
})

test('Filters runs based on showWorkflows setting', async () => {
  const agent = store.agents[0]
  const wrapper: VueWrapper<any> = mount(View, {
    props: { agent }
  })
  await nextTick()

  const historyComponent = wrapper.findComponent({ name: 'History' })

  // Wait for runs to be loaded - accept any number of runs > 0
  await vi.waitFor(() => {
    const runs = historyComponent.props('runs')
    expect(runs.length).toBeGreaterThan(0)
  })

  const allRuns = historyComponent.props('runs')
  const nonWorkflowRuns = allRuns.filter((run: any) => run.trigger !== 'workflow')
  const currentFilter = historyComponent.props('showWorkflows')

  // Check current filter state and visible rows
  let tableRows = historyComponent.findAll('tbody tr:not(.spacer)')

  if (currentFilter === 'exclude') {
    // Should show non-workflow runs
    expect(tableRows.length).toBe(nonWorkflowRuns.length)
  } else {
    // Should show all runs
    expect(tableRows.length).toBe(allRuns.length)
  }

  // Change to show all
  await historyComponent.find('.history-filter').setValue('all')
  await nextTick()

  tableRows = historyComponent.findAll('tbody tr:not(.spacer)')
  expect(tableRows.length).toBe(allRuns.length)

  // Change back to exclude workflows
  await historyComponent.find('.history-filter').setValue('exclude')
  await nextTick()

  tableRows = historyComponent.findAll('tbody tr:not(.spacer)')
  expect(tableRows.length).toBe(nonWorkflowRuns.length)
})

test('Handles agent run update event', async () => {
  const agent = store.agents[0]
  mount(View, {
    props: { agent }
  })
  await nextTick()

  // Simulate agent run update event via eventBus
  emitEvent('agent:run:update', { agentId: agent.uuid, runId: 'new-run' })
  await nextTick()

  // Should have reloaded runs
  expect(window.api.agents.getRuns).toHaveBeenCalledWith(kDefaultWorkspaceId, agent.uuid)
})

test('Ignores agent run update for different agent', async () => {
  const agent = store.agents[0]
  mount(View, {
    props: { agent }
  })
  await nextTick()

  vi.clearAllMocks()

  // Simulate agent run update event for different agent
  emitEvent('agent:run:update', { agentId: 'different-agent', runId: 'new-run' })
  await nextTick()

  // Should not have reloaded runs
  expect(window.api.agents.getRuns).not.toHaveBeenCalled()
})

test('Shows context menu when right-clicking on run', async () => {
  const agent = store.agents[0]
  const wrapper: VueWrapper<any> = mount(View, {
    props: { agent }
  })
  await nextTick()

  // Check initial state - context menu should be hidden
  const vm = wrapper.vm as any
  expect(vm.showMenu).toBe(false)

  const historyComponent = wrapper.findComponent({ name: 'History' })
  
  // Find first table row
  const tableRow = historyComponent.find('tbody tr:not(.spacer)')
  expect(tableRow.exists()).toBe(true)
  
  // Right-click to trigger context menu
  await tableRow.trigger('contextmenu', { preventDefault: vi.fn() })
  await nextTick()

  // Check that showMenu is now true
  expect(vm.showMenu).toBe(true)
})

test('Context menu action deletes runs', async () => {
  
  const agent = store.agents[0]
  const wrapper: VueWrapper<any> = mount(View, {
    props: { agent }
  })

  const vm = wrapper.vm as any
  vm.selection = vm.runs
  await vm.handleActionClick('delete')

  // Check that delete was called for all selected runs (user confirms by default)
  expect(window.api.agents.deleteRun).toHaveBeenCalledTimes(3)
  expect(window.api.agents.deleteRun).toHaveBeenCalledWith(kDefaultWorkspaceId, agent.uuid, 'run1')
  expect(window.api.agents.deleteRun).toHaveBeenCalledWith(kDefaultWorkspaceId, agent.uuid, 'run2')
  expect(window.api.agents.deleteRun).toHaveBeenCalledWith(kDefaultWorkspaceId, agent.uuid, 'run3')
})

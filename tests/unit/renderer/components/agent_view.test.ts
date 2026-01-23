import { vi, beforeAll, beforeEach, afterAll, expect, test } from 'vitest'
import { mount, VueWrapper, enableAutoUnmount } from '@vue/test-utils'
import { createI18nMock } from '@tests/mocks/index'
import { useWindowMock } from '@tests/mocks/window'
import { stubTeleport } from '@tests/mocks/stubs'
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
  expect(wrapper.find('.agent-view').exists()).toBe(true)
  expect(wrapper.find('.sp-sidebar').exists()).toBe(true)
  // Run component contains the execution flow and details panes
  expect(wrapper.findComponent({ name: 'Run' }).exists()).toBe(true)
})

test('Does not render when no agent provided', async () => {
  const wrapper: VueWrapper<any> = mount(View, {
    props: { agent: undefined }
  })

  expect(wrapper.find('.agent-view').exists()).toBe(false)
})

test('Renders header with agent name and action buttons', async () => {
  const agent = store.agents[0]
  const wrapper: VueWrapper<any> = mount(View, {
    ...stubTeleport,
    props: { agent }
  })
  await nextTick()

  expect(wrapper.find('.sp-sidebar header .title').text()).toBe(agent.name)
  expect(wrapper.find('.sp-sidebar .run').exists()).toBe(true)
  // Edit and delete are in context menu - open it first
  await wrapper.find('.context-menu-trigger .trigger').trigger('click')
  await nextTick()
  expect(wrapper.find('.item.edit').exists()).toBe(true)
  expect(wrapper.find('.item.delete').exists()).toBe(true)
})

test('Renders runs list with history filter', async () => {
  const agent = store.agents[0]
  const wrapper: VueWrapper<any> = mount(View, {
    props: { agent }
  })
  await nextTick()

  expect(wrapper.find('.history .header').exists()).toBe(true)
  expect(wrapper.find('.history-filter').exists()).toBe(true)
  expect(wrapper.find('.clear').exists()).toBe(true)
  expect(wrapper.find('.history .items').exists()).toBe(true)
})

test('Loads runs on agent change', async () => {
  const agent = store.agents[0]
  const wrapper: VueWrapper<any> = mount(View, {
    props: { agent: undefined }
  })
  await nextTick()

  // Initially no agent, so no view should be rendered
  expect(wrapper.find('.agent-view').exists()).toBe(false)

  await wrapper.setProps({ agent })
  await nextTick()

  // After agent is set, runs list should show runs
  expect(wrapper.find('.history .items').exists()).toBe(true)
  const runItems = wrapper.findAll('.history .item')
  expect(runItems.length).toBeGreaterThan(0)
})

test('Auto-selects latest run on load (excluding workflows)', async () => {
  const agent = store.agents[0]
  const wrapper: VueWrapper<any> = mount(View, {
    props: { agent }
  })
  await nextTick()

  // Check that filter shows 'exclude'
  const filterSelect = wrapper.find<HTMLSelectElement>('.history-filter')
  expect(filterSelect.element.value).toBe('exclude')

  // Check that RunInfo component is displayed (stepIndex 0 shows RunInfo)
  const runInfo = wrapper.findComponent({ name: 'RunInfo' })
  expect(runInfo.exists()).toBe(true)
})

test('Shows RunInfo component when run is selected (stepIndex 0)', async () => {
  const agent = store.agents[0]
  const wrapper: VueWrapper<any> = mount(View, {
    props: { agent }
  })
  await nextTick()

  // At stepIndex 0, RunInfo is shown
  const runInfo = wrapper.findComponent({ name: 'RunInfo' })
  expect(runInfo.exists()).toBe(true)
  expect(runInfo.props('run').uuid).toBe('run3')
})

test('Shows empty state when no run selected', async () => {
  const agent = store.agents[2] // agent3 has no runs
  const wrapper: VueWrapper<any> = mount(View, {
    props: { agent }
  })
  await nextTick()

  expect(wrapper.findComponent({ name: 'RunInfo' }).exists()).toBe(false)
  expect(wrapper.findComponent({ name: 'StepDetail' }).exists()).toBe(false)
  expect(wrapper.find('.run-placeholder.empty').exists()).toBe(true)
})

test('Adjusts showWorkflows when only workflow runs exist', async () => {
  const agent = store.agents[1]
  const wrapper: VueWrapper<any> = mount(View, {
    props: { agent }
  })
  await nextTick()

  // Check that filter shows 'all' when only workflow runs exist
  const filterSelect = wrapper.find<HTMLSelectElement>('.history-filter')
  expect(filterSelect.element.value).toBe('all')
})

test('Emits run event when run button clicked', async () => {
  const agent = store.agents[0]
  const wrapper: VueWrapper<any> = mount(View, {
    props: { agent }
  })
  await nextTick()

  await wrapper.find('.sp-sidebar .run').trigger('click')

  expect(wrapper.emitted('run')).toBeTruthy()
  expect(wrapper.emitted('run')![0]).toEqual([agent])
})

test('Emits edit event when edit button clicked', async () => {
  const agent = store.agents[0]
  const wrapper: VueWrapper<any> = mount(View, {
    ...stubTeleport,
    props: { agent }
  })
  await nextTick()

  // Open context menu first
  await wrapper.find('.context-menu-trigger .trigger').trigger('click')
  await nextTick()
  await wrapper.find('.item.edit').trigger('click')

  expect(wrapper.emitted('edit')).toBeTruthy()
  expect(wrapper.emitted('edit')![0]).toEqual([agent])
})

test('Emits delete event when delete button clicked', async () => {
  const agent = store.agents[0]
  const wrapper: VueWrapper<any> = mount(View, {
    ...stubTeleport,
    props: { agent }
  })
  await nextTick()

  // Open context menu first
  await wrapper.find('.context-menu-trigger .trigger').trigger('click')
  await nextTick()
  await wrapper.find('.item.delete').trigger('click')

  expect(wrapper.emitted('delete')).toBeTruthy()
  expect(wrapper.emitted('delete')![0]).toEqual([agent])
})

test('Selects run when clicked in runs list', async () => {
  const agent = store.agents[0]
  const wrapper: VueWrapper<any> = mount(View, {
    props: { agent }
  })
  await nextTick()

  const runItems = wrapper.findAll('.history .item')
  expect(runItems.length).toBeGreaterThan(0)

  // Click on first run item
  await runItems[0].trigger('click')
  await nextTick()

  // Check that first item is selected
  expect(runItems[0].classes()).toContain('selected')

  // Check that RunInfo component is visible (stepIndex 0)
  const runInfo = wrapper.findComponent({ name: 'RunInfo' })
  expect(runInfo.exists()).toBe(true)
})

test('Updates showWorkflows when filter changed', async () => {
  const agent = store.agents[0]
  const wrapper = mount(View, {
    props: { agent }
  })

  await nextTick()

  const filterSelect = wrapper.find('.history-filter')
  const vm = wrapper.vm as any

  // Get initial value
  const initialValue = vm.showWorkflows
  const newValue = initialValue === 'all' ? 'exclude' : 'all'

  await filterSelect.setValue(newValue)
  await nextTick()

  expect(vm.showWorkflows).toBe(newValue)
})

test('Handles clear history', async () => {
  const agent = store.agents[0]
  const wrapper: VueWrapper<any> = mount(View, {
    props: { agent }
  })
  await nextTick()

  await wrapper.find('.clear').trigger('click')
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

  // The delete button is now in the Run component's details pane
  const runComponent = wrapper.findComponent({ name: 'Run' })
  await runComponent.find('.details-pane .delete').trigger('click')
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

  const vm = wrapper.vm as any

  // Wait for runs to be loaded
  await vi.waitFor(() => {
    expect(vm.runs.length).toBeGreaterThan(0)
  })

  const allRuns = vm.runs
  const nonWorkflowRuns = allRuns.filter((run: any) => run.trigger !== 'workflow')

  // Check initial filter state (exclude workflows)
  let runItems = wrapper.findAll('.history .item')
  expect(runItems.length).toBe(nonWorkflowRuns.length)

  // Change to show all
  await wrapper.find('.history-filter').setValue('all')
  await nextTick()

  runItems = wrapper.findAll('.history .item')
  expect(runItems.length).toBe(allRuns.length)

  // Change back to exclude workflows
  await wrapper.find('.history-filter').setValue('exclude')
  await nextTick()

  runItems = wrapper.findAll('.history .item')
  expect(runItems.length).toBe(nonWorkflowRuns.length)
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

  // Find first run item
  const runItem = wrapper.find('.history .item')
  expect(runItem.exists()).toBe(true)

  // Right-click to trigger context menu
  await runItem.trigger('contextmenu', { preventDefault: vi.fn() })
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

test('Emits close event when back button clicked', async () => {
  const agent = store.agents[0]
  const wrapper: VueWrapper<any> = mount(View, {
    props: { agent }
  })
  await nextTick()

  await wrapper.find('.icon.back').trigger('click')

  expect(wrapper.emitted('close')).toBeTruthy()
})

test('Shows execution flow canvas when run selected', async () => {
  const agent = store.agents[0]
  const wrapper: VueWrapper<any> = mount(View, {
    props: { agent }
  })
  await nextTick()

  // With a run selected, should show ExecutionFlow component (inside Run)
  const executionFlow = wrapper.findComponent({ name: 'ExecutionFlow' })
  expect(executionFlow.exists()).toBe(true)
  expect(executionFlow.props('agent')).toEqual(agent)
  expect(executionFlow.props('selectedIndex')).toBe(0)
})

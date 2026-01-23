
import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { useWindowMock } from '@tests/mocks/window'
import { store } from '@services/store'
import Run from '@renderer/agent/Run.vue'
import Message from '@models/message'
import { Agent, AgentRun } from '@/types/agents'
import enMessages from '@root/locales/en.json'

beforeAll(async () => {
  useWindowMock()

  // Mock i18n messages
  window.api.config.getI18nMessages = vi.fn(() => ({ en: enMessages }))

  // Re-initialize i18n with actual messages
  const { initI18n } = await import('@services/i18n')
  initI18n()

  store.load()
  store.config.workspaceId = 'test-workspace'
})

const createMockAgent = (overrides: Partial<Agent> = {}): Agent => ({
  uuid: 'test-agent-456',
  name: 'Test Agent',
  description: 'A test agent',
  prompt: 'You are a helpful assistant',
  engine: 'anthropic',
  model: 'claude-sonnet-4-20250514',
  parameters: {},
  steps: [
    { description: 'Step 1', prompt: 'Do step 1' },
    { description: 'Step 2', prompt: 'Do step 2' },
  ],
  ...overrides,
})

const createMockRun = (overrides: Partial<AgentRun> = {}): AgentRun => ({
  uuid: 'test-run-123',
  agentId: 'test-agent-456',
  createdAt: Date.now() - 5000,
  updatedAt: Date.now(),
  trigger: 'manual',
  status: 'success',
  prompt: 'Test prompt for the agent',
  messages: [
    new Message('system', 'System message'),
    new Message('user', 'User message 1'),
    new Message('assistant', 'Assistant response 1'),
    new Message('user', 'User message 2'),
    new Message('assistant', 'Assistant response 2'),
  ],
  ...overrides,
})

beforeEach(() => {
  vi.clearAllMocks()
})

describe('Run.vue', () => {
  test('renders component with run data', async () => {
    const mockAgent = createMockAgent()
    const mockRun = createMockRun()

    const wrapper = mount(Run, {
      props: {
        agent: mockAgent,
        run: mockRun,
      },
    })

    await nextTick()

    expect(wrapper.find('.run-view').exists()).toBe(true)
    expect(wrapper.find('.execution-flow-pane').exists()).toBe(true)
    expect(wrapper.find('.details-pane').exists()).toBe(true)
  })

  test('shows placeholder when no run provided', async () => {
    const mockAgent = createMockAgent()

    const wrapper = mount(Run, {
      props: {
        agent: mockAgent,
        run: null,
      },
    })

    await nextTick()

    expect(wrapper.find('.run-view').exists()).toBe(false)
    expect(wrapper.find('.run-placeholder').exists()).toBe(true)
  })

  test('renders ExecutionFlow component', async () => {
    const mockAgent = createMockAgent()
    const mockRun = createMockRun()

    const wrapper = mount(Run, {
      props: {
        agent: mockAgent,
        run: mockRun,
      },
    })

    await nextTick()

    const executionFlow = wrapper.findComponent({ name: 'ExecutionFlow' })
    expect(executionFlow.exists()).toBe(true)
    expect(executionFlow.props('agent')).toEqual(mockAgent)
    expect(executionFlow.props('run')).toEqual(mockRun)
  })

  test('renders details pane with header', async () => {
    const mockAgent = createMockAgent()
    const mockRun = createMockRun()

    const wrapper = mount(Run, {
      props: {
        agent: mockAgent,
        run: mockRun,
      },
    })

    await nextTick()

    const detailsPane = wrapper.find('.details-pane')
    expect(detailsPane.exists()).toBe(true)
    expect(detailsPane.find('header').exists()).toBe(true)
    expect(detailsPane.find('.title').exists()).toBe(true)
  })

  test('shows RunInfo when step index is 0', async () => {
    const mockAgent = createMockAgent()
    const mockRun = createMockRun()

    const wrapper = mount(Run, {
      props: {
        agent: mockAgent,
        run: mockRun,
      },
    })

    await nextTick()

    // Initially step index is 0, so RunInfo should be shown
    const runInfo = wrapper.findComponent({ name: 'RunInfo' })
    expect(runInfo.exists()).toBe(true)

    const stepDetail = wrapper.findComponent({ name: 'StepDetail' })
    expect(stepDetail.exists()).toBe(false)
  })

  test('shows StepDetail when step is selected', async () => {
    const mockAgent = createMockAgent()
    const mockRun = createMockRun()

    const wrapper = mount(Run, {
      props: {
        agent: mockAgent,
        run: mockRun,
      },
    })

    await nextTick()

    // Simulate selecting a step by emitting from ExecutionFlow
    const executionFlow = wrapper.findComponent({ name: 'ExecutionFlow' })
    await executionFlow.vm.$emit('select', 1)
    await nextTick()

    const runInfo = wrapper.findComponent({ name: 'RunInfo' })
    expect(runInfo.exists()).toBe(false)

    const stepDetail = wrapper.findComponent({ name: 'StepDetail' })
    expect(stepDetail.exists()).toBe(true)
  })

  test('resets step index when run changes', async () => {
    const mockAgent = createMockAgent()
    const mockRun1 = createMockRun({ uuid: 'run-1' })
    const mockRun2 = createMockRun({ uuid: 'run-2' })

    const wrapper = mount(Run, {
      props: {
        agent: mockAgent,
        run: mockRun1,
      },
    })

    await nextTick()

    // Select a step
    const executionFlow = wrapper.findComponent({ name: 'ExecutionFlow' })
    await executionFlow.vm.$emit('select', 2)
    await nextTick()

    // StepDetail should be shown
    expect(wrapper.findComponent({ name: 'StepDetail' }).exists()).toBe(true)

    // Change run
    await wrapper.setProps({ run: mockRun2 })
    await nextTick()

    // Should reset to RunInfo (step index 0)
    expect(wrapper.findComponent({ name: 'RunInfo' }).exists()).toBe(true)
    expect(wrapper.findComponent({ name: 'StepDetail' }).exists()).toBe(false)
  })

  test('emits delete event when delete button clicked', async () => {
    const mockAgent = createMockAgent()
    const mockRun = createMockRun()

    const wrapper = mount(Run, {
      props: {
        agent: mockAgent,
        run: mockRun,
      },
    })

    await nextTick()

    const deleteButton = wrapper.find('.details-pane .delete')
    await deleteButton.trigger('click')

    expect(wrapper.emitted('delete')).toBeTruthy()
  })

  test('passes correct props to StepDetail', async () => {
    const mockAgent = createMockAgent()
    const mockRun = createMockRun()

    const wrapper = mount(Run, {
      props: {
        agent: mockAgent,
        run: mockRun,
      },
    })

    await nextTick()

    // Select step 1
    const executionFlow = wrapper.findComponent({ name: 'ExecutionFlow' })
    await executionFlow.vm.$emit('select', 1)
    await nextTick()

    const stepDetail = wrapper.findComponent({ name: 'StepDetail' })
    expect(stepDetail.props('agent')).toEqual(mockAgent)
    expect(stepDetail.props('run')).toEqual(mockRun)
    expect(stepDetail.props('stepIndex')).toBe(1)
  })

  test('passes correct selectedIndex to ExecutionFlow', async () => {
    const mockAgent = createMockAgent()
    const mockRun = createMockRun()

    const wrapper = mount(Run, {
      props: {
        agent: mockAgent,
        run: mockRun,
      },
    })

    await nextTick()

    let executionFlow = wrapper.findComponent({ name: 'ExecutionFlow' })
    expect(executionFlow.props('selectedIndex')).toBe(0)

    // Select step 2
    await executionFlow.vm.$emit('select', 2)
    await nextTick()

    executionFlow = wrapper.findComponent({ name: 'ExecutionFlow' })
    expect(executionFlow.props('selectedIndex')).toBe(2)
  })
})

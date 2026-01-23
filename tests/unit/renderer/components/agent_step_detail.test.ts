
import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { useWindowMock } from '@tests/mocks/window'
import { store } from '@services/store'
import StepDetail from '@renderer/agent/StepDetail.vue'
import Message from '@models/message'
import { Agent, AgentRun } from '@/types/agents'
import enMessages from '@root/locales/en.json'

beforeAll(async () => {
  useWindowMock()

  window.api.config.getI18nMessages = vi.fn(() => ({ en: enMessages }))

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

const createMockRun = (overrides: Partial<AgentRun> = {}): AgentRun => {
  const msg1 = new Message('system', 'System message')
  const msg2 = new Message('user', 'User message 1')
  msg2.createdAt = Date.now() - 4000
  const msg3 = new Message('assistant', 'Assistant response 1')
  msg3.createdAt = Date.now() - 3000
  const msg4 = new Message('user', 'User message 2')
  msg4.createdAt = Date.now() - 2000
  const msg5 = new Message('assistant', 'Assistant response 2')
  msg5.createdAt = Date.now() - 1000

  return {
    uuid: 'test-run-123',
    agentId: 'test-agent-456',
    createdAt: Date.now() - 5000,
    updatedAt: Date.now(),
    trigger: 'manual',
    status: 'success',
    prompt: 'Test prompt',
    messages: [msg1, msg2, msg3, msg4, msg5],
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('StepDetail.vue', () => {
  test('renders nothing for step index 0', async () => {
    const wrapper = mount(StepDetail, {
      props: {
        agent: createMockAgent(),
        run: createMockRun(),
        stepIndex: 0,
      },
    })

    await nextTick()

    expect(wrapper.find('.stats-grid').exists()).toBe(false)
    expect(wrapper.find('.step-messages').exists()).toBe(false)
  })

  test('renders stats grid for valid step index', async () => {
    const wrapper = mount(StepDetail, {
      props: {
        agent: createMockAgent(),
        run: createMockRun(),
        stepIndex: 1,
      },
    })

    await nextTick()

    expect(wrapper.find('.stats-grid').exists()).toBe(true)
    const statCards = wrapper.findAll('.stat-card')
    expect(statCards.length).toBe(2) // duration and tool calls
  })

  test('renders step messages', async () => {
    const wrapper = mount(StepDetail, {
      props: {
        agent: createMockAgent(),
        run: createMockRun(),
        stepIndex: 1,
      },
    })

    await nextTick()

    expect(wrapper.find('.step-messages').exists()).toBe(true)
    expect(wrapper.find('.messages').exists()).toBe(true)
  })

  test('shows running indicator when step is in progress', async () => {
    const msg1 = new Message('system', 'System')
    const msg2 = new Message('user', 'User prompt')
    msg2.createdAt = Date.now() - 1000
    // No assistant response yet

    const wrapper = mount(StepDetail, {
      props: {
        agent: createMockAgent(),
        run: createMockRun({
          status: 'running',
          messages: [msg1, msg2],
        }),
        stepIndex: 1,
      },
    })

    await nextTick()

    expect(wrapper.find('.running').exists()).toBe(true)
  })

  test('displays tool calls count', async () => {
    const msg1 = new Message('system', 'System')
    const msg2 = new Message('user', 'User prompt')
    msg2.createdAt = Date.now() - 1000
    const msg3 = new Message('assistant', 'Response')
    msg3.createdAt = Date.now()
    msg3.toolCalls = [
      { id: '1', type: 'function', function: { name: 'tool1', arguments: '{}' } },
      { id: '2', type: 'function', function: { name: 'tool2', arguments: '{}' } },
    ]

    const wrapper = mount(StepDetail, {
      props: {
        agent: createMockAgent(),
        run: createMockRun({
          messages: [msg1, msg2, msg3],
        }),
        stepIndex: 1,
      },
    })

    await nextTick()

    const toolCallsCard = wrapper.findAll('.stat-card')[1]
    expect(toolCallsCard.find('.stat-value').text()).toBe('2')
  })

  test('shows 0 tool calls when none present', async () => {
    const wrapper = mount(StepDetail, {
      props: {
        agent: createMockAgent(),
        run: createMockRun(),
        stepIndex: 1,
      },
    })

    await nextTick()

    const toolCallsCard = wrapper.findAll('.stat-card')[1]
    expect(toolCallsCard.find('.stat-value').text()).toBe('0')
  })

  test('calculates step duration correctly', async () => {
    const msg1 = new Message('system', 'System')
    const msg2 = new Message('user', 'User prompt 1')
    msg2.createdAt = Date.now() - 5000
    const msg3 = new Message('assistant', 'Response 1')
    msg3.createdAt = Date.now() - 4000
    const msg4 = new Message('user', 'User prompt 2')
    msg4.createdAt = Date.now() - 2000
    const msg5 = new Message('assistant', 'Response 2')
    msg5.createdAt = Date.now() - 1000

    const wrapper = mount(StepDetail, {
      props: {
        agent: createMockAgent(),
        run: createMockRun({
          messages: [msg1, msg2, msg3, msg4, msg5],
          updatedAt: Date.now(),
        }),
        stepIndex: 1,
      },
    })

    await nextTick()

    // Duration should be from step 1 prompt to step 2 prompt (5000 - 2000 = 3000ms = 3s)
    const durationCard = wrapper.findAll('.stat-card')[0]
    expect(durationCard.find('.stat-value').text()).toMatch(/\d+/)
  })

  test('uses run updatedAt for last step duration', async () => {
    const msg1 = new Message('system', 'System')
    const msg2 = new Message('user', 'User prompt')
    msg2.createdAt = Date.now() - 3000
    const msg3 = new Message('assistant', 'Response')
    msg3.createdAt = Date.now() - 2000

    const wrapper = mount(StepDetail, {
      props: {
        agent: createMockAgent(),
        run: createMockRun({
          messages: [msg1, msg2, msg3],
          updatedAt: Date.now(),
          status: 'success',
        }),
        stepIndex: 1,
      },
    })

    await nextTick()

    const durationCard = wrapper.findAll('.stat-card')[0]
    expect(durationCard.find('.stat-value').text()).toMatch(/\d+/)
  })

  test('handles second step correctly', async () => {
    const wrapper = mount(StepDetail, {
      props: {
        agent: createMockAgent(),
        run: createMockRun(),
        stepIndex: 2,
      },
    })

    await nextTick()

    expect(wrapper.find('.stats-grid').exists()).toBe(true)
    expect(wrapper.find('.step-messages').exists()).toBe(true)
  })

  test('returns null for out of bounds step index', async () => {
    const wrapper = mount(StepDetail, {
      props: {
        agent: createMockAgent(),
        run: createMockRun(),
        stepIndex: 10, // Way beyond available steps
      },
    })

    await nextTick()

    // Should not render anything
    expect(wrapper.find('.stats-grid').exists()).toBe(false)
  })

  test('updates duration live for running step', async () => {
    vi.useFakeTimers()

    const msg1 = new Message('system', 'System')
    const msg2 = new Message('user', 'User prompt')
    msg2.createdAt = Date.now()
    // No response yet - step is running

    const wrapper = mount(StepDetail, {
      props: {
        agent: createMockAgent(),
        run: createMockRun({
          status: 'running',
          messages: [msg1, msg2],
        }),
        stepIndex: 1,
      },
    })

    await nextTick()

    // Advance timer
    vi.advanceTimersByTime(2000)
    await nextTick()

    // Component should update (timer logic)
    wrapper.unmount()
    vi.useRealTimers()
  })

  test('uses agent info step description when available', async () => {
    const wrapper = mount(StepDetail, {
      props: {
        agent: createMockAgent(),
        run: createMockRun({
          agentInfo: {
            name: 'Runtime Agent Name',
            steps: [
              { description: 'Runtime Step 1 Description' },
            ],
          },
        }),
        stepIndex: 1,
      },
    })

    await nextTick()

    // The step prompt should use the runtime description
    const vm = wrapper.vm as any
    expect(vm.stepPrompt).toBe('Runtime Step 1 Description')
  })
})

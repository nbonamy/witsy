import { flushPromises, mount } from '@vue/test-utils'
import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import Run from '@renderer/agent/Run.vue'
import { store } from '@services/store'
import { useWindowMock } from '@tests/mocks/window'
import { AgentRun } from 'types/agents'

// Mock the i18n service
vi.mock('@services/i18n', () => ({
  t: (key: string) => key
}))

// Mock child components
vi.mock('@renderer/agent/ExecutionFlow.vue', () => ({
  default: {
    name: 'ExecutionFlow',
    props: ['agent', 'run', 'selectedIndex'],
    emits: ['select'],
    template: '<div class="execution-flow-mock"></div>'
  }
}))

vi.mock('@renderer/agent/RunInfo.vue', () => ({
  default: {
    name: 'RunInfo',
    props: ['agent', 'run'],
    template: '<div class="run-info-mock"></div>'
  }
}))

vi.mock('@renderer/agent/StepDetail.vue', () => ({
  default: {
    name: 'StepDetail',
    props: ['agent', 'run', 'stepIndex'],
    template: '<div class="step-detail-mock"></div>'
  }
}))

beforeAll(() => {
  useWindowMock()
  store.loadSettings()
})

beforeEach(() => {
  vi.clearAllMocks()
  store.agents = []
  store.loadAgents()
})

describe('Run component', () => {
  const createTestRun = (): AgentRun => ({
    uuid: 'test-run-123',
    agentId: store.agents[0].uuid,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    trigger: 'manual',
    status: 'running',
    prompt: 'Test prompt',
    messages: [],
    toolCalls: [],
    steps: []
  })

  test('Shows placeholder when no run is selected', () => {
    const agent = store.agents[0]
    const wrapper = mount(Run, {
      props: {
        agent,
        run: null,
        runningExecutions: new Map()
      }
    })

    expect(wrapper.find('.run-placeholder.empty').exists()).toBe(true)
    expect(wrapper.find('.run-view').exists()).toBe(false)
  })

  test('Shows run details when run is selected', () => {
    const agent = store.agents[0]
    const run = createTestRun()

    const wrapper = mount(Run, {
      props: {
        agent,
        run,
        runningExecutions: new Map()
      }
    })

    expect(wrapper.find('.run-view').exists()).toBe(true)
    expect(wrapper.find('.run-placeholder').exists()).toBe(false)
  })

  test('Does not show stop button when run is not executing', () => {
    const agent = store.agents[0]
    const run = createTestRun()

    const wrapper = mount(Run, {
      props: {
        agent,
        run,
        runningExecutions: new Map()
      }
    })

    expect(wrapper.find('.button-icon.stop').exists()).toBe(false)
  })

  test('Shows stop button when run is actively executing', () => {
    const agent = store.agents[0]
    const run = createTestRun()

    // Create a running execution with the run's uuid as the key
    const runningExecutions = new Map()
    runningExecutions.set(run.uuid, {
      agent,
      runId: run.uuid,
      startTime: Date.now()
    })

    const wrapper = mount(Run, {
      props: {
        agent,
        run,
        runningExecutions
      }
    })

    expect(wrapper.find('.button-icon.stop').exists()).toBe(true)
  })

  test('Stop button emits stop event with agentId and runId payload', async () => {
    const agent = store.agents[0]
    const run = createTestRun()

    const runningExecutions = new Map()
    runningExecutions.set(run.uuid, {
      agent,
      runId: run.uuid,
      startTime: Date.now()
    })

    const wrapper = mount(Run, {
      props: {
        agent,
        run,
        runningExecutions
      }
    })

    // Click stop button
    await wrapper.find('.button-icon.stop').trigger('click')
    await flushPromises()

    // Should emit stop with { agentId, runId } payload
    expect(wrapper.emitted('stop')).toBeTruthy()
    expect(wrapper.emitted('stop')[0]).toEqual([{ agentId: agent.uuid, runId: run.uuid }])
  })

  test('Does not show stop button for different run', () => {
    const agent = store.agents[0]
    const run = createTestRun()

    // Create execution for a different run (key is different-run-id)
    const runningExecutions = new Map()
    runningExecutions.set('different-run-id', {
      agent,
      runId: 'different-run-id',
      startTime: Date.now()
    })

    const wrapper = mount(Run, {
      props: {
        agent,
        run,
        runningExecutions
      }
    })

    expect(wrapper.find('.button-icon.stop').exists()).toBe(false)
  })

  test('Shows stop button for correct run when multiple executions exist', () => {
    const agent = store.agents[0]
    const run = createTestRun()

    // Create multiple executions, one matches the run
    const runningExecutions = new Map()
    runningExecutions.set('other-run-1', {
      agent,
      runId: 'other-run-1',
      startTime: Date.now()
    })
    runningExecutions.set(run.uuid, {
      agent,
      runId: run.uuid,
      startTime: Date.now()
    })
    runningExecutions.set('other-run-2', {
      agent,
      runId: 'other-run-2',
      startTime: Date.now()
    })

    const wrapper = mount(Run, {
      props: {
        agent,
        run,
        runningExecutions
      }
    })

    expect(wrapper.find('.button-icon.stop').exists()).toBe(true)
  })

  test('Delete button always shows and emits delete event', async () => {
    const agent = store.agents[0]
    const run = createTestRun()

    const wrapper = mount(Run, {
      props: {
        agent,
        run,
        runningExecutions: new Map()
      }
    })

    expect(wrapper.find('.button-icon.delete').exists()).toBe(true)

    await wrapper.find('.button-icon.delete').trigger('click')
    await flushPromises()

    expect(wrapper.emitted('delete')).toBeTruthy()
  })

  test('isRunning returns false when no run', () => {
    const agent = store.agents[0]

    const wrapper = mount(Run, {
      props: {
        agent,
        run: null,
        runningExecutions: new Map()
      }
    })

    expect(wrapper.vm.isRunning()).toBe(false)
  })

  test('isRunning returns false when no matching execution', () => {
    const agent = store.agents[0]
    const run = createTestRun()

    const runningExecutions = new Map()
    runningExecutions.set('different-run-id', {
      agent,
      runId: 'different-run-id',
      startTime: Date.now()
    })

    const wrapper = mount(Run, {
      props: {
        agent,
        run,
        runningExecutions
      }
    })

    expect(wrapper.vm.isRunning()).toBe(false)
  })

  test('isRunning returns true when matching execution exists', () => {
    const agent = store.agents[0]
    const run = createTestRun()

    const runningExecutions = new Map()
    runningExecutions.set('other-run', {
      agent,
      runId: 'other-run',
      startTime: Date.now()
    })
    runningExecutions.set(run.uuid, {
      agent,
      runId: run.uuid,
      startTime: Date.now()
    })

    const wrapper = mount(Run, {
      props: {
        agent,
        run,
        runningExecutions
      }
    })

    expect(wrapper.vm.isRunning()).toBe(true)
  })

  test('Stop button disappears when execution completes', async () => {
    const agent = store.agents[0]
    const run = createTestRun()

    const runningExecutions = new Map()
    runningExecutions.set(run.uuid, {
      agent,
      runId: run.uuid,
      startTime: Date.now()
    })

    const wrapper = mount(Run, {
      props: {
        agent,
        run,
        runningExecutions
      }
    })

    // Stop button should exist
    expect(wrapper.find('.button-icon.stop').exists()).toBe(true)

    // Update props to remove the execution
    await wrapper.setProps({
      runningExecutions: new Map()
    })

    // Stop button should be gone
    expect(wrapper.find('.button-icon.stop').exists()).toBe(false)
  })
})

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

    // Create a running execution with the run's ID
    const runningExecutions = new Map()
    runningExecutions.set('exec-1', {
      agent,
      abortController: new AbortController(),
      runId: run.uuid
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

  test('Stop button emits stop event with correct execution ID', async () => {
    const agent = store.agents[0]
    const run = createTestRun()

    const executionId = 'exec-123'
    const runningExecutions = new Map()
    runningExecutions.set(executionId, {
      agent,
      abortController: new AbortController(),
      runId: run.uuid
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

    // Should emit stop with execution ID
    expect(wrapper.emitted('stop')).toBeTruthy()
    expect(wrapper.emitted('stop')[0]).toEqual([executionId])
  })

  test('Does not show stop button for different run', () => {
    const agent = store.agents[0]
    const run = createTestRun()

    // Create execution for a different run
    const runningExecutions = new Map()
    runningExecutions.set('exec-1', {
      agent,
      abortController: new AbortController(),
      runId: 'different-run-id'
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

    // Create multiple executions
    const runningExecutions = new Map()
    runningExecutions.set('exec-1', {
      agent,
      abortController: new AbortController(),
      runId: 'other-run-1'
    })
    runningExecutions.set('exec-2', {
      agent,
      abortController: new AbortController(),
      runId: run.uuid // This one matches
    })
    runningExecutions.set('exec-3', {
      agent,
      abortController: new AbortController(),
      runId: 'other-run-2'
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

  test('getExecutionIdForRun returns null when no run', () => {
    const agent = store.agents[0]

    const wrapper = mount(Run, {
      props: {
        agent,
        run: null,
        runningExecutions: new Map()
      }
    })

    expect(wrapper.vm.getExecutionIdForRun()).toBeNull()
  })

  test('getExecutionIdForRun returns null when no matching execution', () => {
    const agent = store.agents[0]
    const run = createTestRun()

    const runningExecutions = new Map()
    runningExecutions.set('exec-1', {
      agent,
      abortController: new AbortController(),
      runId: 'different-run-id'
    })

    const wrapper = mount(Run, {
      props: {
        agent,
        run,
        runningExecutions
      }
    })

    expect(wrapper.vm.getExecutionIdForRun()).toBeNull()
  })

  test('getExecutionIdForRun returns correct execution ID', () => {
    const agent = store.agents[0]
    const run = createTestRun()

    const executionId = 'exec-match'
    const runningExecutions = new Map()
    runningExecutions.set('exec-1', {
      agent,
      abortController: new AbortController(),
      runId: 'other-run'
    })
    runningExecutions.set(executionId, {
      agent,
      abortController: new AbortController(),
      runId: run.uuid
    })

    const wrapper = mount(Run, {
      props: {
        agent,
        run,
        runningExecutions
      }
    })

    expect(wrapper.vm.getExecutionIdForRun()).toBe(executionId)
  })

  test('Stop button disappears when execution completes', async () => {
    const agent = store.agents[0]
    const run = createTestRun()

    const runningExecutions = new Map()
    runningExecutions.set('exec-1', {
      agent,
      abortController: new AbortController(),
      runId: run.uuid
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

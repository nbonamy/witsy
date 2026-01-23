
import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { useWindowMock } from '@tests/mocks/window'
import ExecutionFlow from '@renderer/agent/ExecutionFlow.vue'
import Message from '@models/message'
import { Agent, AgentRun } from '@/types/agents'

// Mock canvas context
const createMockCanvasContext = () => ({
  clearRect: vi.fn(),
  save: vi.fn(),
  restore: vi.fn(),
  scale: vi.fn(),
  translate: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  stroke: vi.fn(),
  fill: vi.fn(),
  arc: vi.fn(),
  closePath: vi.fn(),
  quadraticCurveTo: vi.fn(),
  fillText: vi.fn(),
  fillStyle: '',
  strokeStyle: '',
  lineWidth: 1,
  font: '',
  textAlign: '',
  textBaseline: '',
  globalAlpha: 1,
})

// Mock ResizeObserver
class MockResizeObserver {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
}

beforeAll(() => {
  useWindowMock()

  // Mock ResizeObserver globally
  vi.stubGlobal('ResizeObserver', MockResizeObserver)
})

beforeEach(() => {
  vi.clearAllMocks()
})

const createMockAgent = (overrides: Partial<Agent> = {}): Agent => ({
  uuid: 'test-agent-456',
  name: 'Test Agent',
  description: 'A test agent description',
  prompt: 'You are a helpful assistant',
  engine: 'anthropic',
  model: 'claude-sonnet-4-20250514',
  parameters: {},
  steps: [
    { description: 'First step', prompt: 'Do step 1' },
    { description: 'Second step', prompt: 'Do step 2' },
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
  prompt: 'Test prompt',
  messages: [
    new Message('system', 'System message'),
    new Message('user', 'User message 1'),
    new Message('assistant', 'Assistant response 1'),
    new Message('user', 'User message 2'),
    new Message('assistant', 'Assistant response 2'),
  ],
  ...overrides,
})

const mountWithCanvas = (props: { agent: Agent; run?: AgentRun | null; selectedIndex?: number }) => {
  const mockCtx = createMockCanvasContext()

  const wrapper = mount(ExecutionFlow, {
    props: {
      selectedIndex: 0,
      ...props,
    },
    attachTo: document.body,
  })

  // Mock the canvas getContext
  const canvas = wrapper.find('canvas').element as HTMLCanvasElement
  vi.spyOn(canvas, 'getContext').mockReturnValue(mockCtx as unknown as CanvasRenderingContext2D)

  // Mock getBoundingClientRect for container
  const container = wrapper.find('.execution-flow').element
  vi.spyOn(container, 'getBoundingClientRect').mockReturnValue({
    width: 400,
    height: 600,
    top: 0,
    left: 0,
    right: 400,
    bottom: 600,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  })

  return { wrapper, mockCtx }
}

describe('ExecutionFlow.vue', () => {
  test('renders canvas element', () => {
    const { wrapper } = mountWithCanvas({
      agent: createMockAgent(),
      run: createMockRun(),
    })

    expect(wrapper.find('.execution-flow').exists()).toBe(true)
    expect(wrapper.find('canvas').exists()).toBe(true)
    wrapper.unmount()
  })

  test('exposes nodes computed property', async () => {
    const { wrapper } = mountWithCanvas({
      agent: createMockAgent(),
      run: createMockRun(),
    })

    await nextTick()

    const nodes = (wrapper.vm as any).nodes
    expect(nodes).toBeDefined()
    expect(Array.isArray(nodes)).toBe(true)
    // First node is the agent
    expect(nodes[0].type).toBe('agent')
    expect(nodes[0].label).toBe('Test Agent')
    wrapper.unmount()
  })

  test('computes correct number of step nodes', async () => {
    const { wrapper } = mountWithCanvas({
      agent: createMockAgent(),
      run: createMockRun(),
    })

    await nextTick()

    const nodes = (wrapper.vm as any).nodes
    // Agent node + 2 step nodes (from 4 user/assistant message pairs after system)
    expect(nodes.length).toBe(3) // agent + 2 steps
    expect(nodes[1].type).toBe('step')
    expect(nodes[2].type).toBe('step')
    wrapper.unmount()
  })

  test('shows agent as running when run status is running', async () => {
    const { wrapper } = mountWithCanvas({
      agent: createMockAgent(),
      run: createMockRun({ status: 'running' }),
    })

    await nextTick()

    const nodes = (wrapper.vm as any).nodes
    expect(nodes[0].status).toBe('running')
    wrapper.unmount()
  })

  test('emits select event on canvas click', async () => {
    const { wrapper } = mountWithCanvas({
      agent: createMockAgent(),
      run: createMockRun(),
    })

    await nextTick()

    // Manually set hit targets to simulate drawn nodes
    const vm = wrapper.vm as any
    vm.hitTargets = [
      { index: 0, x: 100, y: 50, width: 200, height: 60 },
      { index: 1, x: 100, y: 150, width: 200, height: 60 },
    ]

    // Simulate click within first hit target
    const canvas = wrapper.find('canvas')
    await canvas.trigger('click', { clientX: 200, clientY: 80 })

    expect(wrapper.emitted('select')).toBeTruthy()
    expect(wrapper.emitted('select')![0]).toEqual([0])
    wrapper.unmount()
  })

  test('handles wheel event for scrolling', async () => {
    const { wrapper, mockCtx } = mountWithCanvas({
      agent: createMockAgent(),
      run: createMockRun(),
    })

    await nextTick()

    // Force canPan to true for testing
    const vm = wrapper.vm as any
    vm.canPan = true

    const canvas = wrapper.find('canvas')

    // Create wheel event manually to test scrolling
    const wheelEvent = new WheelEvent('wheel', {
      deltaY: 100,
      bubbles: true,
      cancelable: true,
    })
    canvas.element.dispatchEvent(wheelEvent)

    await nextTick()

    // Canvas should have been redrawn
    expect(mockCtx.clearRect).toHaveBeenCalled()
    wrapper.unmount()
  })

  test('handles mouse drag for panning', async () => {
    const { wrapper } = mountWithCanvas({
      agent: createMockAgent(),
      run: createMockRun(),
    })

    await nextTick()

    // Force canPan to true for testing
    const vm = wrapper.vm as any
    vm.canPan = true

    const canvas = wrapper.find('canvas')

    // Simulate drag
    await canvas.trigger('mousedown', { clientY: 100 })
    await canvas.trigger('mousemove', { clientY: 150 })
    await canvas.trigger('mouseup')

    // After drag, didDrag should be set if moved enough
    wrapper.unmount()
  })

  test('updates cursor on mouse move over hit target', async () => {
    const { wrapper } = mountWithCanvas({
      agent: createMockAgent(),
      run: createMockRun(),
    })

    await nextTick()

    // Set hit targets
    const vm = wrapper.vm as any
    vm.hitTargets = [
      { index: 0, x: 100, y: 50, width: 200, height: 60 },
    ]

    const canvas = wrapper.find('canvas')

    // Move mouse over hit target
    await canvas.trigger('mousemove', { clientX: 200, clientY: 80 })

    expect((canvas.element as HTMLCanvasElement).style.cursor).toBe('pointer')
    wrapper.unmount()
  })

  test('handles mouseleave event', async () => {
    const { wrapper } = mountWithCanvas({
      agent: createMockAgent(),
      run: createMockRun(),
    })

    await nextTick()

    const canvas = wrapper.find('canvas')

    // Simulate mouse leave (which calls onMouseUp)
    await canvas.trigger('mouseleave')

    // Should not throw and isDragging should be false
    const vm = wrapper.vm as any
    expect(vm.isDragging).toBe(false)
    wrapper.unmount()
  })

  test('renders with no run provided', async () => {
    const { wrapper } = mountWithCanvas({
      agent: createMockAgent(),
      run: null,
    })

    await nextTick()

    const nodes = (wrapper.vm as any).nodes
    // Only agent node when no run
    expect(nodes.length).toBe(1)
    expect(nodes[0].type).toBe('agent')
    wrapper.unmount()
  })

  test('starts pulse animation when run is running', async () => {
    vi.useFakeTimers()

    const { wrapper } = mountWithCanvas({
      agent: createMockAgent(),
      run: createMockRun({ status: 'running' }),
    })

    await nextTick()

    // Let the watcher trigger
    await nextTick()

    // Advance timer to trigger pulse interval
    vi.advanceTimersByTime(100)

    // pulsePhase should have changed
    const vm = wrapper.vm as any
    expect(vm.pulsePhase).toBeGreaterThan(0)

    wrapper.unmount()
    vi.useRealTimers()
  })

  test('stops pulse animation when run completes', async () => {
    vi.useFakeTimers()

    const { wrapper } = mountWithCanvas({
      agent: createMockAgent(),
      run: createMockRun({ status: 'running' }),
    })

    await nextTick()
    await nextTick()

    // Change status to success
    await wrapper.setProps({
      run: createMockRun({ status: 'success' }),
    })

    await nextTick()

    // Pulse animation should have stopped
    const vm = wrapper.vm as any
    const phaseBeforeAdvance = vm.pulsePhase

    vi.advanceTimersByTime(100)

    // Phase should not have changed after stopping
    expect(vm.pulsePhase).toBe(phaseBeforeAdvance)

    wrapper.unmount()
    vi.useRealTimers()
  })

  test('skips click selection after drag', async () => {
    const { wrapper } = mountWithCanvas({
      agent: createMockAgent(),
      run: createMockRun(),
    })

    await nextTick()

    const vm = wrapper.vm as any
    vm.canPan = true
    vm.hitTargets = [
      { index: 0, x: 100, y: 50, width: 200, height: 60 },
    ]

    const canvas = wrapper.find('canvas')

    // Simulate drag (more than 3 pixels)
    await canvas.trigger('mousedown', { clientY: 100 })
    await canvas.trigger('mousemove', { clientY: 150 })
    await canvas.trigger('mouseup')

    // Now click - should be skipped due to didDrag flag
    await canvas.trigger('click', { clientX: 200, clientY: 80 })

    // Select should not be emitted because we just dragged
    expect(wrapper.emitted('select')).toBeFalsy()
    wrapper.unmount()
  })

  test('handles step with running status on last step', async () => {
    const { wrapper } = mountWithCanvas({
      agent: createMockAgent(),
      run: createMockRun({
        status: 'running',
        messages: [
          new Message('system', 'System'),
          new Message('user', 'User 1'),
          // No assistant response yet - step is in progress
        ],
      }),
    })

    await nextTick()

    const nodes = (wrapper.vm as any).nodes
    // Agent + 1 step
    expect(nodes.length).toBe(2)
    // Last step should be running
    expect(nodes[1].status).toBe('running')
    wrapper.unmount()
  })
})

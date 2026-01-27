
import { beforeAll, beforeEach, expect, test, vi, describe } from 'vitest'
import { mount } from '@vue/test-utils'
import { useWindowMock } from '@tests/mocks/window'
import AgentCard from '@renderer/agent/AgentCard.vue'
import { Agent } from 'types/agents'

vi.mock('@services/i18n', () => ({
  t: (key: string) => key
}))

beforeAll(() => {
  useWindowMock()
})

beforeEach(() => {
  vi.clearAllMocks()
})

const createMockAgent = (overrides: Partial<Agent> = {}): Agent => ({
  uuid: 'test-agent',
  name: 'Test Agent',
  description: 'A test agent description',
  engine: 'openai',
  model: 'gpt-4',
  parameters: [],
  steps: [],
  ...overrides,
} as Agent)

describe('AgentCard.vue', () => {
  test('renders agent name and description', () => {
    const agent = createMockAgent()
    const wrapper = mount(AgentCard, {
      props: { agent, starting: false, runningCount: 0, runningExecutions: [] },
    })

    expect(wrapper.find('h3').text()).toBe('Test Agent')
    expect(wrapper.find('p').text()).toBe('A test agent description')
  })

  test('emits run event when run button clicked', async () => {
    const agent = createMockAgent()
    const wrapper = mount(AgentCard, {
      props: { agent, starting: false, runningCount: 0, runningExecutions: [] },
    })

    const runButton = wrapper.findAll('button').find(b => b.text().includes('agent.forge.run'))
    await runButton!.trigger('click')

    expect(wrapper.emitted('run')).toBeTruthy()
    expect(wrapper.emitted('run')![0]).toEqual([agent])
  })

  test('emits view event when view button clicked', async () => {
    const agent = createMockAgent()
    const wrapper = mount(AgentCard, {
      props: { agent, starting: false, runningCount: 0, runningExecutions: [] },
    })

    const viewButton = wrapper.findAll('button').find(b => b.text().includes('agent.forge.view'))
    await viewButton!.trigger('click')

    expect(wrapper.emitted('view')).toBeTruthy()
    expect(wrapper.emitted('view')![0]).toEqual([agent])
  })

  test('renders context menu trigger', () => {
    const agent = createMockAgent()
    const wrapper = mount(AgentCard, {
      props: { agent, starting: false, runningCount: 0, runningExecutions: [] },
    })

    expect(wrapper.findComponent({ name: 'ContextMenuTrigger' }).exists()).toBe(true)
  })

  test('shows spinner icon when starting is true', () => {
    const agent = createMockAgent()
    const wrapper = mount(AgentCard, {
      props: { agent, starting: true, runningCount: 0, runningExecutions: [] },
    })

    // SpinningIcon should be rendered when starting
    expect(wrapper.findComponent({ name: 'SpinningIcon' }).exists()).toBe(true)
  })

  test('shows play icon svg when starting is false', () => {
    const agent = createMockAgent()
    const wrapper = mount(AgentCard, {
      props: { agent, starting: false, runningCount: 0, runningExecutions: [] },
    })

    // PlayIcon should be rendered (it renders as SVG)
    const runButton = wrapper.findAll('button').find(b => b.text().includes('agent.forge.run'))
    expect(runButton).toBeDefined()
    expect(runButton!.find('svg').exists()).toBe(true)
  })

  test('renders footer with buttons', () => {
    const agent = createMockAgent()
    const wrapper = mount(AgentCard, {
      props: { agent, starting: false, runningCount: 0, runningExecutions: [] },
    })

    const footer = wrapper.find('.card-footer')
    expect(footer.exists()).toBe(true)
    expect(footer.findAll('button').length).toBeGreaterThanOrEqual(2)
  })
})

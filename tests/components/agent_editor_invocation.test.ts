import { vi, beforeAll, beforeEach, afterAll, expect, test } from 'vitest'
import { mount, VueWrapper, enableAutoUnmount } from '@vue/test-utils'
import { createI18nMock } from '../mocks/index'
import { useWindowMock } from '../mocks/window'
import { store } from '../../src/services/store'
import Editor from '../../src/agent/Editor.vue'
import Agent from '../../src/models/agent'
import { nextTick } from 'vue'

enableAutoUnmount(afterAll)

vi.mock('../../src/services/i18n', async () => {
  return createI18nMock()
})

beforeAll(() => {
  useWindowMock()
  store.loadSettings()
})

beforeEach(() => {
  vi.clearAllMocks()
  store.agents = []
})

test('Shows invocation step with schedule and variables', async () => {
  const agent = new Agent()
  agent.steps = [
    { prompt: 'Hello {{name}}, how are you?', tools: null, agents: [] }
  ]
  agent.schedule = '0 9 * * *'
  agent.invocationValues = { name: 'World' }

  const wrapper: VueWrapper<any> = mount(Editor, {
    props: { 
      mode: 'edit',
      agent: agent
    }
  })
  await nextTick()

  // Navigate to invocation step
  const steps = wrapper.findAll('.md-master-list-item')
  const invocationStep = steps.find(step => step.text().includes('agent.create.invocation.title'))
  expect(invocationStep).toBeTruthy()
  
  await invocationStep!.trigger('click')
  await nextTick()

  // Should show Scheduler component
  const scheduler = wrapper.findComponent({ name: 'Scheduler' })
  expect(scheduler.exists()).toBe(true)

  // Should show variables table for prompt inputs
  const variablesTable = wrapper.find('.variables')
  expect(variablesTable.exists()).toBe(true)
  
  const variableRows = variablesTable.findAll('tbody tr')
  expect(variableRows.length).toBe(1)
  expect(variableRows[0].text()).toContain('name')

  // Should show next runs display (since schedule is set)
  const nextRunsSection = wrapper.find('[for="next"]')
  expect(nextRunsSection).toBeTruthy()
})

test('Shows next runs when schedule is set', async () => {
  const agent = new Agent()
  agent.schedule = '0 9 * * *' // 9 AM daily
  agent.steps = [
    { prompt: 'Hello', tools: null, agents: [] }
  ]

  const wrapper: VueWrapper<any> = mount(Editor, {
    props: { 
      mode: 'edit',
      agent: agent
    }
  })
  await nextTick()

  // Navigate to invocation step
  const steps = wrapper.findAll('.md-master-list-item')
  const invocationStep = steps.find(step => step.text().includes('agent.create.invocation.title'))
  await invocationStep!.trigger('click')
  await nextTick()

  // Should show next runs section
  const nextRunsLabel = wrapper.find('label[for="next"]')
  expect(nextRunsLabel.exists()).toBe(true)
})

test('Updates invocation variables when typing', async () => {
  
  const agent = new Agent()
  agent.steps = [
    { prompt: 'Hello {{name}}, welcome to {{place}}', tools: null, agents: [] }
  ]
  agent.schedule = '0 9 * * *'
  agent.invocationValues = { name: 'John', place: 'Paris' }

  const wrapper: VueWrapper<any> = mount(Editor, {
    props: { 
      mode: 'edit',
      agent: agent
    }
  })
  await nextTick()

  // Navigate to invocation step
  const steps = wrapper.findAll('.md-master-list-item')
  const invocationStep = steps.find(step => step.text().includes('agent.create.invocation.title'))
  await invocationStep!.trigger('click')
  await nextTick()

  // Should show variables table with input fields
  const variableInputs = wrapper.findAll('.variables input[type="text"]')
  expect(variableInputs.length).toBe(2)
  
  // Values should be populated
  expect((variableInputs[0].element as HTMLInputElement).value).toBe('John')
  expect((variableInputs[1].element as HTMLInputElement).value).toBe('Paris')

  // Change a value
  await variableInputs[0].setValue('Jane')
  await variableInputs[0].trigger('input')
  
  // Should update the value
  expect((variableInputs[0].element as HTMLInputElement).value).toBe('Jane')
})
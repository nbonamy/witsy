import { vi, beforeAll, beforeEach, afterAll, expect, test } from 'vitest'
import { mount, VueWrapper, enableAutoUnmount } from '@vue/test-utils'
import { createI18nMock } from '../../../mocks/index'
import { useWindowMock } from '../../../mocks/window'
import { store } from '../../../../src/renderer/services/store'
import Editor from '../../../../src/renderer/agent/Editor.vue'
import Agent from '../../../../src/models/agent'
import Dialog from '../../../../src/renderer/utils/dialog'
import { nextTick } from 'vue'

enableAutoUnmount(afterAll)

vi.mock('../../../../src/renderer/services/i18n', async () => {
  return createI18nMock()
})

vi.mock('../../../../src/renderer/utils/dialog', () => ({
  default: {
    show: vi.fn(),
    waitUntilClosed: vi.fn()
  }
}))

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
  const steps = wrapper.findAll('.wizard-step')
  const invocationStep = steps.find(step => step.text().includes('agent.create.invocation.title'))
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
  const steps = wrapper.findAll('.wizard-step')
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
  const steps = wrapper.findAll('.wizard-step')
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

test('Shows variables from all workflow steps (not just step 0)', async () => {
  const agent = new Agent()
  agent.steps = [
    { prompt: 'Hello {{name}}, how are you?', tools: null, agents: [] },
    { prompt: 'You are {{age}} years old', tools: null, agents: [] },
    { prompt: 'You live in {{city}}', tools: null, agents: [] }
  ]
  agent.schedule = '0 9 * * *'
  agent.invocationValues = { name: 'John', age: '30', city: 'Paris' }

  const wrapper: VueWrapper<any> = mount(Editor, {
    props: {
      mode: 'edit',
      agent: agent
    }
  })
  await nextTick()

  // Navigate to invocation step
  const steps = wrapper.findAll('.wizard-step')
  const invocationStep = steps.find(step => step.text().includes('agent.create.invocation.title'))
  await invocationStep!.trigger('click')
  await nextTick()

  // Should show variables table with ALL variables from ALL steps
  const variableRows = wrapper.findAll('.variables tbody tr')
  expect(variableRows.length).toBe(3)

  // Check that all variables are present
  const rowTexts = variableRows.map(row => row.text())
  expect(rowTexts.some(text => text.includes('name'))).toBe(true)
  expect(rowTexts.some(text => text.includes('age'))).toBe(true)
  expect(rowTexts.some(text => text.includes('city'))).toBe(true)
})

test('Shows variables from step 2+ and deduplicates across steps', async () => {
  const agent = new Agent()
  agent.steps = [
    { prompt: 'Hello {{name}}', tools: null, agents: [] },
    { prompt: 'Your name is {{name}} and you are {{age}} years old', tools: null, agents: [] }
  ]
  agent.schedule = '0 9 * * *'
  agent.invocationValues = { name: 'John', age: '30' }

  const wrapper: VueWrapper<any> = mount(Editor, {
    props: {
      mode: 'edit',
      agent: agent
    }
  })
  await nextTick()

  // Navigate to invocation step
  const steps = wrapper.findAll('.wizard-step')
  const invocationStep = steps.find(step => step.text().includes('agent.create.invocation.title'))
  await invocationStep!.trigger('click')
  await nextTick()

  // Should deduplicate 'name' variable and show both name and age
  const variableRows = wrapper.findAll('.variables tbody tr')
  expect(variableRows.length).toBe(2)

  const rowTexts = variableRows.map(row => row.text())
  expect(rowTexts.some(text => text.includes('name'))).toBe(true)
  expect(rowTexts.some(text => text.includes('age'))).toBe(true)
})

test('Shows dialog when saving webhook agent with missing invocation values', async () => {
  // Enable HTTP endpoints in config
  store.config.general.enableHttpEndpoints = true

  const agent = new Agent()
  agent.steps = [
    { prompt: 'Hello {{name}}, you are {{age}} years old', tools: null, agents: [] }
  ]
  agent.webhookToken = 'test-token-123'
  agent.invocationValues = { name: 'John' } // age is missing

  const wrapper: VueWrapper<any> = mount(Editor, {
    props: {
      mode: 'edit',
      agent: agent
    }
  })
  await nextTick()

  // Mock dialog to return that user wants to go back (isConfirmed: true)
  vi.mocked(Dialog.show).mockResolvedValueOnce({ isConfirmed: true })

  // Navigate to invocation step
  const steps = wrapper.findAll('.wizard-step')
  const invocationStep = steps.find(step => step.text().includes('agent.create.invocation.title'))
  await invocationStep!.trigger('click')
  await nextTick()

  // Click save button
  const saveButton = wrapper.find('button[name="next"]')
  await saveButton.trigger('click')
  await nextTick()

  // Dialog should have been shown about missing values
  expect(Dialog.show).toHaveBeenCalledWith(expect.objectContaining({
    title: 'agent.create.invocation.missingInputs.title',
    text: 'agent.create.invocation.missingInputs.text',
    confirmButtonText: 'agent.create.invocation.missingInputs.confirmButtonText',
    cancelButtonText: 'agent.create.invocation.missingInputs.cancelButtonText',
    showCancelButton: true
  }))
})

test('Shows dialog when saving scheduled agent with missing invocation values', async () => {
  const agent = new Agent()
  agent.steps = [
    { prompt: 'Query: {{query}}, sections: {{sections}}', tools: null, agents: [] }
  ]
  agent.schedule = '0 9 * * *'
  agent.invocationValues = {} // all missing

  const wrapper: VueWrapper<any> = mount(Editor, {
    props: {
      mode: 'edit',
      agent: agent
    }
  })
  await nextTick()

  // Mock dialog to return that user wants to go back (isConfirmed: true)
  vi.mocked(Dialog.show).mockResolvedValueOnce({ isConfirmed: true })

  // Navigate to invocation step
  const steps = wrapper.findAll('.wizard-step')
  const invocationStep = steps.find(step => step.text().includes('agent.create.invocation.title'))
  await invocationStep!.trigger('click')
  await nextTick()

  // Click save button
  const saveButton = wrapper.find('button[name="next"]')
  await saveButton.trigger('click')
  await nextTick()

  // Dialog should have been shown
  expect(Dialog.show).toHaveBeenCalledWith(expect.objectContaining({
    title: 'agent.create.invocation.missingInputs.title',
    showCancelButton: true
  }))
})

test('Allows "Save anyway" when user cancels missing values dialog', async () => {
  const agent = new Agent()
  agent.steps = [
    { prompt: 'Hello {{name}}', tools: null, agents: [] }
  ]
  agent.schedule = '0 9 * * *'
  agent.invocationValues = {} // missing value

  const wrapper: VueWrapper<any> = mount(Editor, {
    props: {
      mode: 'edit',
      agent: agent
    }
  })
  await nextTick()

  // Mock agents.save to return true
  vi.mocked(window.api.agents.save).mockReturnValueOnce(true)

  // Mock dialog to return that user clicks "Save anyway" (isConfirmed: false, isDismissed: false)
  vi.mocked(Dialog.show).mockResolvedValueOnce({ isConfirmed: false, isDismissed: false })

  // Navigate to invocation step
  const steps = wrapper.findAll('.wizard-step')
  const invocationStep = steps.find(step => step.text().includes('agent.create.invocation.title'))
  await invocationStep!.trigger('click')
  await nextTick()

  // Click save button
  const saveButton = wrapper.find('button[name="next"]')
  await saveButton.trigger('click')
  await nextTick()

  // Dialog should have been shown
  expect(Dialog.show).toHaveBeenCalledWith(expect.objectContaining({
    title: 'agent.create.invocation.missingInputs.title',
  }))

  // Since user chose "Save anyway", save event should be emitted
  expect(wrapper.emitted('save')).toBeTruthy()
})

test('Does not show dialog when all invocation values are provided', async () => {
  const agent = new Agent()
  agent.steps = [
    { prompt: 'Hello {{name}}', tools: null, agents: [] }
  ]
  agent.schedule = '0 9 * * *'
  agent.invocationValues = { name: 'John' } // all values provided

  const wrapper: VueWrapper<any> = mount(Editor, {
    props: {
      mode: 'edit',
      agent: agent
    }
  })
  await nextTick()

  // Mock agents.save to return true
  vi.mocked(window.api.agents.save).mockReturnValueOnce(true)

  // Navigate to invocation step
  const steps = wrapper.findAll('.wizard-step')
  const invocationStep = steps.find(step => step.text().includes('agent.create.invocation.title'))
  await invocationStep!.trigger('click')
  await nextTick()

  // Click save button
  const saveButton = wrapper.find('button[name="next"]')
  await saveButton.trigger('click')
  await nextTick()

  // Dialog should NOT have been shown since all values are provided
  expect(Dialog.show).not.toHaveBeenCalled()

  // Save event should be emitted
  expect(wrapper.emitted('save')).toBeTruthy()
})

test('Does not validate invocation values for manual-only agents', async () => {
  const agent = new Agent()
  agent.steps = [
    { prompt: 'Hello {{name}}', tools: null, agents: [] }
  ]
  // No schedule, no webhook - manual only
  agent.invocationValues = {} // missing value, but should not trigger dialog

  const wrapper: VueWrapper<any> = mount(Editor, {
    props: {
      mode: 'edit',
      agent: agent
    }
  })
  await nextTick()

  // Mock agents.save to return true
  vi.mocked(window.api.agents.save).mockReturnValueOnce(true)

  // Navigate to invocation step
  const steps = wrapper.findAll('.wizard-step')
  const invocationStep = steps.find(step => step.text().includes('agent.create.invocation.title'))
  await invocationStep!.trigger('click')
  await nextTick()

  // Click save button
  const saveButton = wrapper.find('button[name="next"]')
  await saveButton.trigger('click')
  await nextTick()

  // Dialog should NOT have been shown for manual-only agents
  expect(Dialog.show).not.toHaveBeenCalled()

  // Save event should be emitted
  expect(wrapper.emitted('save')).toBeTruthy()
})
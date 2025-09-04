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

test('Renders editor in create mode', async () => {
  const wrapper: VueWrapper<any> = mount(Editor, {
    props: { 
      mode: 'create',
      agent: undefined
    }
  })
  await nextTick()

  // Should show welcome header in create mode
  const welcomeHeader = wrapper.find('.md-master-header')
  expect(welcomeHeader.exists()).toBe(true)
  expect(welcomeHeader.find('.md-master-header-title').text()).toContain('Welcome to the Create')

  // Should show step navigation
  const steps = wrapper.findAll('.md-master-list-item')
  expect(steps.length).toBeGreaterThan(0)
  
  // First step (Generator) should be selected
  const firstStep = steps[0]
  expect(firstStep.classes()).toContain('selected')
  expect(firstStep.text()).toContain('agent.create.generator.title')

  // Should show wizard step content
  const wizardStep = wrapper.findComponent({ name: 'WizardStep' })
  expect(wizardStep.exists()).toBe(true)
})

test('Renders editor in edit mode', async () => {
  const agent = new Agent()
  agent.name = 'Test Agent'
  agent.description = 'Test Description'
  
  const wrapper: VueWrapper<any> = mount(Editor, {
    props: { 
      mode: 'edit',
      agent: agent
    }
  })
  await nextTick()

  // Should not show welcome header in edit mode
  const welcomeHeader = wrapper.find('.md-master-header')
  expect(welcomeHeader.exists()).toBe(false)

  // Should show footer with save/cancel buttons in edit mode
  const footer = wrapper.find('.md-master-footer')
  expect(footer.exists()).toBe(true)
  
  const buttons = footer.findAll('button')
  expect(buttons.length).toBe(2)
  expect(buttons[0].text()).toBe('common.cancel')
  expect(buttons[1].text()).toBe('common.save')
})

test('Shows different steps for witsy vs a2a agents', async () => {
  // Test witsy agent (should have all steps including Goal)
  const witsyAgent = new Agent()
  witsyAgent.source = 'witsy'
  
  const witsyWrapper = mount(Editor, {
    props: { 
      mode: 'create',
      agent: witsyAgent
    }
  })
  await nextTick()

  const witsySteps = witsyWrapper.findAll('.md-master-list-item')
  const witsyStepTexts = witsySteps.map(step => step.text())
  expect(witsyStepTexts.some(text => text.includes('agent.create.goal.title'))).toBe(true)

  // Test a2a agent (should not have Goal step)
  const a2aAgent = new Agent()
  a2aAgent.source = 'a2a'
  
  const a2aWrapper = mount(Editor, {
    props: { 
      mode: 'create',
      agent: a2aAgent
    }
  })
  await nextTick()

  const a2aSteps = a2aWrapper.findAll('.md-master-list-item')
  const a2aStepTexts = a2aSteps.map(step => step.text())
  expect(a2aStepTexts.some(text => text.includes('agent.create.goal.title'))).toBe(false)
})

test('Allows navigation between steps by clicking', async () => {
  const wrapper: VueWrapper<any> = mount(Editor, {
    props: { 
      mode: 'create',
      agent: undefined
    }
  })
  await nextTick()

  const steps = wrapper.findAll('.md-master-list-item')
  expect(steps.length).toBeGreaterThan(1)

  // First step should be selected initially
  expect(steps[0].classes()).toContain('selected')

  // Click on second step (should be enabled since it's create mode)
  await steps[1].trigger('click')
  await nextTick()

  // Second step should now be selected
  expect(steps[1].classes()).toContain('selected')
  expect(steps[0].classes()).not.toContain('selected')
})









test('Emits cancel event when cancel button clicked', async () => {
  const wrapper: VueWrapper<any> = mount(Editor, {
    props: { 
      mode: 'edit',
      agent: new Agent()
    }
  })
  await nextTick()

  const cancelButton = wrapper.find('.md-master-footer button:first-child')
  await cancelButton.trigger('click')

  expect(wrapper.emitted('cancel')).toBeTruthy()
  expect(wrapper.emitted('cancel')![0]).toEqual([])
})

test('Calls save API when save button clicked', async () => {
  const agent = new Agent()
  agent.name = 'Test Agent'
  agent.description = 'Test Description'

  const wrapper: VueWrapper<any> = mount(Editor, {
    props: { 
      mode: 'edit',
      agent: agent
    }
  })
  await nextTick()

  const saveButton = wrapper.find('.md-master-footer button:last-child')
  await saveButton.trigger('click')

  expect(window.api.agents.save).toHaveBeenCalled()
})




// === VALIDATION TESTS ===





// === STEP NAVIGATION TESTS ===

test('Previous button functionality', async () => {
  const wrapper: VueWrapper<any> = mount(Editor, {
    props: { 
      mode: 'create',
      agent: undefined
    }
  })
  await nextTick()

  // Navigate to second step first
  const steps = wrapper.findAll('.md-master-list-item')
  await steps[1].trigger('click')
  await nextTick()

  expect(steps[1].classes()).toContain('selected')

  // Click previous button
  const wizardStep = wrapper.findComponent({ name: 'WizardStep' })
  await wizardStep.vm.$emit('prev')
  await nextTick()

  // Should go back to first step
  expect(steps[0].classes()).toContain('selected')
  expect(steps[1].classes()).not.toContain('selected')
})

test('Previous button from first step emits cancel', async () => {
  const wrapper: VueWrapper<any> = mount(Editor, {
    props: { 
      mode: 'create',
      agent: undefined
    }
  })
  await nextTick()

  // Click previous button from first step
  const wizardStep = wrapper.findComponent({ name: 'WizardStep' })
  await wizardStep.vm.$emit('prev')
  await nextTick()

  // Should emit cancel event
  expect(wrapper.emitted('cancel')).toBeTruthy()
})

// === WORKFLOW MANAGEMENT TESTS ===









// === MODEL & ENGINE TESTS ===


// === INVOCATION & SCHEDULE TESTS ===




// === SAVE VALIDATION TESTS ===

test('Save validation - calls save API when all required fields are present', async () => {
  const agent = new Agent()
  agent.name = 'Test Agent'
  agent.description = 'Test Description'
  agent.steps = [
    { prompt: 'Hello {{name}}', tools: null, agents: [] }
  ]
  agent.invocationValues = { name: 'World' } // Provide required values

  const wrapper: VueWrapper<any> = mount(Editor, {
    props: { 
      mode: 'edit',
      agent: agent
    }
  })
  await nextTick()

  // Try to save
  const saveButton = wrapper.find('.md-master-footer button:last-child')
  await saveButton.trigger('click')
  await nextTick()

  // Should call the save API
  expect(window.api.agents.save).toHaveBeenCalled()
})

// === SETTINGS STEP TESTS ===


// === JSON SCHEMA TESTS ===






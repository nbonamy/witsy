import { vi, beforeAll, beforeEach, afterAll, expect, test } from 'vitest'
import { mount, VueWrapper, enableAutoUnmount } from '@vue/test-utils'
import { createI18nMock } from '../mocks/index'
import { useWindowMock } from '../mocks/window'
import { store } from '../../src/renderer/services/store'
import Editor from '../../src/renderer/agent/Editor.vue'
import Agent from '../../src/models/agent'
import { nextTick } from 'vue'

enableAutoUnmount(afterAll)

vi.mock('../../src/renderer/services/i18n', async () => {
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

test('Shows form fields for information step', async () => {
  const wrapper: VueWrapper<any> = mount(Editor, {
    props: { 
      mode: 'create',
      agent: undefined
    }
  })
  await nextTick()

  // Should show name field
  const nameField = wrapper.find('input[name="name"]')
  expect(nameField.exists()).toBe(true)

  // Should show description field
  const descriptionField = wrapper.find('textarea[name="description"]')
  expect(descriptionField.exists()).toBe(true)

  // Should show type field
  const typeField = wrapper.find('select[name="type"]')
  expect(typeField.exists()).toBe(true)
  
  // Type field should have options
  const typeOptions = typeField.findAll('option')
  expect(typeOptions.length).toBe(2)
  expect(typeOptions[0].attributes('value')).toBe('runnable')
  expect(typeOptions[1].attributes('value')).toBe('support')

  // Should show goal field
  const goalField = wrapper.find('textarea[name="goal"]')
  expect(goalField.exists()).toBe(true)
})

test('Populates form fields with agent data in edit mode', async () => {
  const agent = new Agent()
  agent.name = 'Test Agent Name'
  agent.description = 'Test Agent Description'
  agent.instructions = 'Test Agent Goal'
  agent.type = 'support'

  const wrapper: VueWrapper<any> = mount(Editor, {
    props: { 
      mode: 'edit',
      agent: agent
    }
  })
  await nextTick()

  // Fields should be populated with agent data
  const nameField = wrapper.find<HTMLInputElement>('input[name="name"]')
  expect(nameField.element.value).toBe('Test Agent Name')

  const descriptionField = wrapper.find<HTMLTextAreaElement>('textarea[name="description"]')
  expect(descriptionField.element.value).toBe('Test Agent Description')

  const goalField = wrapper.find<HTMLTextAreaElement>('textarea[name="goal"]')
  expect(goalField.element.value).toBe('Test Agent Goal')

  const typeField = wrapper.find<HTMLSelectElement>('select[name="type"]')
  expect(typeField.element.value).toBe('support')
})

test('Validates information step - shows error for empty fields', async () => {
  const wrapper: VueWrapper<any> = mount(Editor, {
    props: { 
      mode: 'create',
      agent: undefined
    }
  })
  await nextTick()

  // Leave fields empty and try to proceed
  const wizardStep = wrapper.findAllComponents({ name: 'WizardStep' })[0]
  
  // Find and click the Next button (emits 'next' event)
  await wizardStep.vm.$emit('next')
  await nextTick()

  // Should show error message in HTML
  const errorDiv = wizardStep.find('.error')
  expect(errorDiv.exists()).toBe(true)
  expect(errorDiv.text()).toBe('common.required.fieldsRequired')
  
  // Should still be on the same step (general step)
  const steps = wrapper.findAll('.wizard-step')
  const activeStep = steps.find(step => step.classes().includes('active'))
  expect(activeStep).toBeTruthy()
  expect(activeStep!.text()).toContain('agent.create.information.title')
})

test('Validates information step - proceeds when fields are filled', async () => {
  const wrapper: VueWrapper<any> = mount(Editor, {
    props: { 
      mode: 'create',
      agent: undefined
    }
  })
  await nextTick()

  // Fill in required fields
  const nameField = wrapper.find<HTMLInputElement>('input[name="name"]')
  await nameField.setValue('Test Agent')
  
  const descriptionField = wrapper.find<HTMLTextAreaElement>('textarea[name="description"]')
  await descriptionField.setValue('Test Description')

  const goalField = wrapper.find<HTMLTextAreaElement>('textarea[name="goal"]')
  await goalField.setValue('Test Goal')

  // Try to proceed
  const wizardStep = wrapper.findAllComponents({ name: 'WizardStep' })[0]
  await wizardStep.vm.$emit('next')
  await nextTick()

  // Should move to next step (Model step for witsy agents)
  const steps = wrapper.findAll('.wizard-step')
  const activeStep = steps.find(step => step.classes().includes('active'))
  expect(activeStep).toBeTruthy()
  expect(activeStep!.text()).toContain('agent.create.llm.title')
})

test('Validates goal field is required', async () => {
  const wrapper: VueWrapper<any> = mount(Editor, {
    props: { 
      mode: 'create',
      agent: undefined
    }
  })
  await nextTick()

  // Fill in name and description but leave goal empty
  const nameField = wrapper.find<HTMLInputElement>('input[name="name"]')
  await nameField.setValue('Test Agent')
  
  const descriptionField = wrapper.find<HTMLTextAreaElement>('textarea[name="description"]')
  await descriptionField.setValue('Test Description')

  // Try to proceed with empty goal
  const wizardStep = wrapper.findAllComponents({ name: 'WizardStep' })[0]
  await wizardStep.vm.$emit('next')
  await nextTick()

  // Should show error message
  const errorDiv = wizardStep.find('.error')
  expect(errorDiv.exists()).toBe(true)
  expect(errorDiv.text()).toBe('common.required.fieldsRequired')
})
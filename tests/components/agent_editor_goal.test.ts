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

test('Shows goal step form fields', async () => {
  const wrapper: VueWrapper<any> = mount(Editor, {
    props: { 
      mode: 'create',
      agent: undefined
    }
  })
  await nextTick()

  // Navigate to goal step
  const steps = wrapper.findAll('.md-master-list-item')
  const goalStep = steps.find(step => step.text().includes('agent.create.goal.title'))
  expect(goalStep).toBeTruthy()
  
  await goalStep!.trigger('click')
  await nextTick()

  // Should show goal textarea
  const goalField = wrapper.find('textarea[name="goal"]')
  expect(goalField.exists()).toBe(true)
})

test('Goal step has validation for empty instructions', async () => {
  const agent = new Agent()
  agent.name = 'Test Agent'
  agent.description = 'Test Description'
  
  const wrapper: VueWrapper<any> = mount(Editor, {
    props: { 
      mode: 'create',
      agent: agent
    }
  })
  await nextTick()

  // Navigate to goal step
  const steps = wrapper.findAll('.md-master-list-item')
  const goalStep = steps.find(step => step.text().includes('agent.create.goal.title'))
  await goalStep!.trigger('click')
  await nextTick()

  // Should show required field - the validation happens on form submission
  const instructionsField = wrapper.find<HTMLTextAreaElement>('textarea[name="goal"]')
  expect(instructionsField.exists()).toBe(true)
  expect(instructionsField.attributes('required')).toBeDefined()
})
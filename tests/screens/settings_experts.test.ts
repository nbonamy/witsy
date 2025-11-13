
import { vi, beforeAll, beforeEach, afterAll, expect, test } from 'vitest'
import { mount, VueWrapper, enableAutoUnmount } from '@vue/test-utils'
import { ChatModel } from 'multi-llm-ts'
import { useWindowMock } from '../mocks/window'
import { createI18nMock } from '../mocks'
import { kDefaultWorkspaceId, store } from '../../src/renderer/services/store'
import SettingsExperts from '../../src/renderer/screens/Settings.vue'
import { Workspace } from '../../src/types/workspace'

enableAutoUnmount(afterAll)

HTMLDialogElement.prototype.showModal = vi.fn()
HTMLDialogElement.prototype.close = vi.fn()

vi.mock('../../src/renderer/services/i18n', async () => {
  return createI18nMock()
})

let wrapper: VueWrapper<any>

beforeAll(() => {

  useWindowMock()
  store.loadSettings()

  // override
  store.config.engines.openai = {
    models: {
      chat: [ { id: 'chat1', name: 'chat1'} as ChatModel, { id: 'chat2', name: 'chat2' } as ChatModel ]
    },
    model: {
      chat: 'chat1'
    }
  }
  window.api.config.localeLLM = () => store.config.llm.locale || 'en-US'

})

beforeEach(() => {
  vi.clearAllMocks()
  store.loadExperts()
  wrapper = mount(SettingsExperts, { props: { workspace: { uuid: kDefaultWorkspaceId } as Workspace } })
})

test('Renders', async () => {

  expect(wrapper.findAll('.table-plain')).toHaveLength(1)
  expect(wrapper.findAll('.table-plain tr.expert')).toHaveLength(4)
  expect(wrapper.findAll('.table-plain tr.expert button')).toHaveLength(8)

})

test('Disable items', async () => {

  // Click the ButtonSwitch in the enabled column to toggle state
  const buttonSwitch = wrapper.find('.table-plain tr.expert:nth-of-type(1)').findComponent({ name: 'ButtonSwitch' })
  await buttonSwitch.find('input').trigger('change')
  expect(window.api.experts.save).toHaveBeenCalledWith(kDefaultWorkspaceId, expect.arrayContaining([
    expect.objectContaining({ id: 'uuid1', state: 'disabled' })
  ]))

  await buttonSwitch.find('input').trigger('change')
  expect(window.api.experts.save).toHaveBeenCalledWith(kDefaultWorkspaceId, expect.arrayContaining([
    expect.objectContaining({ id: 'uuid1', state: 'enabled' })
  ]))

})

test.skip('Move items', async () => {

  const first = wrapper.find('.table-plain tr.expert').attributes('data-id')
  const second = wrapper.find('.table-plain tr.expert:nth-of-type(2)').attributes('data-id')
  await wrapper.find('.table-plain tr.expert:nth-of-type(2) button:nth-of-type(2)').trigger('click')
  expect(wrapper.find('.table-plain tr.expert').attributes('data-id')).toBe(second)
  expect(wrapper.find('.table-plain tr.expert:nth-of-type(2)').attributes('data-id')).toBe(first)
  await wrapper.find('.table-plain tr.expert:nth-of-type(1) button:nth-of-type(1)').trigger('click')
  expect(wrapper.find('.table-plain tr.expert').attributes('data-id')).toBe(first)
  expect(wrapper.find('.table-plain tr.expert:nth-of-type(2)').attributes('data-id')).toBe(second)

})

test('New expert with default engine and model', async () => {

  expect(wrapper.findAll('.table-plain tr.expert')).toHaveLength(4)
  await wrapper.find('button[name="new"]').trigger('click')

  const editor = wrapper.findComponent({ name: 'ExpertEditor' })
  await editor.find('[name=name]').setValue('expert')
  await editor.find('[name=prompt]').setValue('prompt')
  await editor.find('button.default').trigger('click')
  await wrapper.vm.$nextTick()

  expect(window.api.experts.save).toHaveBeenCalledWith(kDefaultWorkspaceId, expect.arrayContaining([
    expect.objectContaining({
      id: expect.any(String),
      type: 'user',
      name: 'expert',
      prompt: 'prompt',
      triggerApps: [],
      state: 'enabled'
    })
  ]))

})

test('New expert with engine and model', async () => {

  await wrapper.find('button[name="new"]').trigger('click')

  const editor = wrapper.findComponent({ name: 'ExpertEditor' })
  await editor.find('[name=name]').setValue('expert_with_engine')
  await editor.find('[name=prompt]').setValue('prompt_with_engine')
  const engineModelSelect = editor.findComponent({ name: 'EngineModelSelect' })
  await engineModelSelect.vm.$emit('modelSelected', 'openai', 'chat1')
  await editor.find('button.default').trigger('click')
  await wrapper.vm.$nextTick()

  expect(window.api.experts.save).toHaveBeenCalledWith(kDefaultWorkspaceId, expect.arrayContaining([
    expect.objectContaining({
      id: expect.any(String),
      type: 'user',
      name: 'expert_with_engine',
      prompt: 'prompt_with_engine',
      engine: 'openai',
      model: 'chat1',
      triggerApps: [],
      state: 'enabled'
    })
  ]))

})

test('Create user expert', async () => {

  // First create a user expert to edit
  await wrapper.find('button[name="new"]').trigger('click')

  const editor = wrapper.findComponent({ name: 'ExpertEditor' })
  await editor.find('[name=name]').setValue('user_expert')
  await editor.find('[name=prompt]').setValue('user_prompt')
  await editor.find('button.default').trigger('click')
  await wrapper.vm.$nextTick()

  expect(window.api.experts.save).toHaveBeenCalledWith(kDefaultWorkspaceId, expect.arrayContaining([
    expect.objectContaining({
      type: 'user',
      name: 'user_expert',
      prompt: 'user_prompt',
      triggerApps: [],
      state: 'enabled'
    })
  ]))

})

test('Edit user expert', async () => {

  await wrapper.find('.table-plain tr.expert:nth-of-type(4) .edit').trigger('click')

  const editor = wrapper.findComponent({ name: 'ExpertEditor' })
  await editor.find('[name=name]').setValue('user_expert_edited')
  await editor.find('[name=prompt]').setValue('user_prompt_edited')
  await editor.find('button.default').trigger('click')

  expect(window.api.experts.save).toHaveBeenCalledWith(kDefaultWorkspaceId, expect.arrayContaining([
    expect.objectContaining({
      id: 'uuid4',
      type: 'user',
      name: 'user_expert_edited',
      prompt: 'user_prompt_edited',
      triggerApps: [],
      state: 'enabled'
    })
  ]))

})

test('Edit system expert', async () => {

  await wrapper.find('.table-plain tr.expert:nth-of-type(1) button.edit').trigger('click')

  const editor = wrapper.findComponent({ name: 'ExpertEditor' })
  expect(editor.find<HTMLInputElement>('[name=name]').element.value).toBe('expert_uuid1_name')
  expect(editor.find<HTMLTextAreaElement>('[name=prompt]').element.value).toBe('expert_uuid1_prompt')
  expect(editor.find<HTMLAnchorElement>('[name=reset]').exists()).toBe(true)

  await editor.find('[name=name]').setValue('expert')
  await editor.find('[name=prompt]').setValue('prompt')
  await editor.find('[name=reset]').trigger('click')

  expect(editor.find<HTMLInputElement>('[name=name]').element.value).toBe('expert_default_uuid1_name')
  expect(editor.find<HTMLTextAreaElement>('[name=prompt]').element.value).toBe('expert_default_uuid1_prompt')
  expect(editor.find<HTMLAnchorElement>('[name=reset]').exists()).toBe(false)

  await editor.find('[name=name]').setValue('expert')
  await editor.find('[name=prompt]').setValue('prompt')
  await editor.find('button.default').trigger('click')

  expect(window.api.experts.save).toHaveBeenCalledWith(kDefaultWorkspaceId, expect.arrayContaining([
    expect.objectContaining({
      id: 'uuid1',
      type: 'system',
      name: 'expert',
      prompt: 'prompt'
    })
  ]))

})

test('Delete expert', async () => {
  expect(wrapper.findAll('.table-plain tr.expert')).toHaveLength(4)
  await wrapper.find('.table-plain tr.expert:nth-of-type(1) td:first-child input[type="checkbox"]').setValue(true)
  await wrapper.find('.toolbar button[name=delete]').trigger('click')
  expect(wrapper.findAll('.table-plain tr.expert')).toHaveLength(3)
  expect(window.api.experts.save).toHaveBeenCalledWith(kDefaultWorkspaceId, expect.arrayContaining([
    expect.objectContaining({ id: 'uuid1', state: 'deleted' })
  ]))

})

test('Copy expert', async () => {
  expect(wrapper.findAll('.table-plain tr.expert')).toHaveLength(4)
  await wrapper.find('.table-plain tr.expert:nth-of-type(1) td:first-child input[type="checkbox"]').setValue(true)
  await wrapper.find('.toolbar button[name=copy]').trigger('click')
  expect(wrapper.findAll('.table-plain tr.expert')).toHaveLength(5)
  expect(window.api.experts.save).toHaveBeenCalledWith(kDefaultWorkspaceId, expect.arrayContaining([
    expect.objectContaining({
      id: expect.any(String),
      type: 'user',
      name: 'expert_uuid1_name (settings.experts.copy)',
      description: 'expert_uuid1_description',
      prompt: 'expert_uuid1_prompt',
      state: 'enabled',
    })
  ]))

})

// test('Context Menu', async () => {

//   expect(wrapper.findAll('.context-menu')).toHaveLength(0)
//   const menuTrigger = wrapper.find('.list-actions .list-action.menu .trigger')
//   await menuTrigger.trigger('click')
//   expect(wrapper.findAll('.context-menu').length).toBeGreaterThan(0)

// })

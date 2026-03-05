import { vi, beforeAll, beforeEach, afterEach, expect, test } from 'vitest'
import { mount, VueWrapper } from '@vue/test-utils'
import { useWindowMock, useBrowserMock } from '@tests/mocks/window'
import { defineComponent, h } from 'vue'
import { store } from '@services/store'
import SettingsSkills from '@renderer/settings/SettingsSkills.vue'
import Dialog from '@renderer/utils/dialog'
import { switchToTab, tabs } from './settings_utils'
import Settings from '@screens/Settings.vue'

HTMLDialogElement.prototype.showModal = vi.fn()
HTMLDialogElement.prototype.close = vi.fn()

let wrapper: VueWrapper<any>
const skillsIndex = tabs.indexOf('settingsSkills')
let skillsWrapper: VueWrapper<any>
const listLoadSpy = vi.fn()

const SkillsListStub = defineComponent({
  name: 'SkillsList',
  emits: ['create', 'edit'],
  setup(_props, { emit, expose }) {
    expose({ load: listLoadSpy })
    return () => h('div', { class: 'skills-list-stub' }, [
      h('button', { class: 'emit-create', onClick: () => emit('create') }, 'create'),
      h('button', {
        class: 'emit-edit-readonly',
        onClick: () => emit('edit', {
          id: 'skill_1',
          name: 'Read only skill',
          description: 'desc',
          instructions: 'content',
          readonly: true,
        })
      }, 'edit-readonly'),
      h('button', {
        class: 'emit-edit-update',
        onClick: () => emit('edit', {
          id: 'skill_2',
          name: 'Editable skill',
          description: 'desc',
          instructions: 'content',
          readonly: false,
        })
      }, 'edit-update')
    ])
  }
})

const SkillEditorStub = defineComponent({
  name: 'SkillEditor',
  props: {
    skill: { type: Object, default: null },
    readonly: { type: Boolean, default: false },
  },
  emits: ['skill-modified'],
  setup(props) {
    return () => h('div', {
      class: 'skill-editor-stub',
      'data-readonly': props.readonly ? '1' : '0',
    })
  }
})

beforeAll(() => {
  useWindowMock()
  useBrowserMock()
  store.loadSettings()
  store.load = () => {}
  wrapper = mount(Settings)
})

beforeEach(async () => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  listLoadSpy.mockClear()
  skillsWrapper = mount(SettingsSkills, {
    global: {
      stubs: {
        SkillsList: SkillsListStub,
        SkillEditor: SkillEditorStub,
      }
    }
  })
})

afterEach(async () => {
  vi.useRealTimers()
})

test('skills settings in top-level tab', async () => {
  const tab = await switchToTab(wrapper, skillsIndex)

  expect(tab.find('input[type=checkbox]').exists()).toBeTruthy()
  expect(tab.find<HTMLInputElement>('input[type=checkbox]').element.checked).toBe(false)
  await tab.find<HTMLInputElement>('input[type=checkbox]').setValue(true)
  expect(store.config.plugins.skills.enabled).toBe(true)

  expect(window.api.skills.defaultLocations).toHaveBeenCalled()
  expect(window.api.skills.list).toHaveBeenCalled()
  expect(tab.find('button[name=install]').exists()).toBeTruthy()
  expect(tab.find('.toolbar-menu').exists()).toBeTruthy()
})

test('create flow opens editor with empty draft', async () => {
  await skillsWrapper.find('.emit-create').trigger('click')
  const editor = skillsWrapper.findComponent({ name: 'SkillEditor' })
  expect(editor.props('readonly')).toBe(false)
  expect(editor.props('skill')).toMatchObject({
    name: '',
    description: '',
    instructions: '',
  })
  expect(skillsWrapper.find('.editor.visible').exists()).toBe(true)
})

test('readonly edit flow opens editor in readonly mode', async () => {
  await skillsWrapper.find('.emit-edit-readonly').trigger('click')
  const editor = skillsWrapper.findComponent({ name: 'SkillEditor' })
  expect(editor.props('readonly')).toBe(true)
  expect(editor.props('skill')).toMatchObject({ id: 'skill_1', readonly: true })
})

test('save create maps payload with instructions and reloads list', async () => {
  await skillsWrapper.find('.emit-create').trigger('click')
  const editor = skillsWrapper.findComponent({ name: 'SkillEditor' })
  editor.vm.$emit('skill-modified', {
    name: 'New skill',
    description: 'Skill description',
    instructions: 'Skill instructions',
  })
  await skillsWrapper.vm.$nextTick()

  expect(window.api.skills.create).toHaveBeenCalledWith(store.config.workspaceId, {
    name: 'New skill',
    description: 'Skill description',
    instructions: 'Skill instructions',
  })
  expect(listLoadSpy).toHaveBeenCalled()
  expect(skillsWrapper.find('.editor.visible').exists()).toBe(false)
})

test('save update maps payload with instructions and reloads list', async () => {
  await skillsWrapper.find('.emit-edit-update').trigger('click')
  const editor = skillsWrapper.findComponent({ name: 'SkillEditor' })
  editor.vm.$emit('skill-modified', {
    id: 'skill_2',
    name: 'Updated skill',
    description: 'Updated description',
    instructions: 'Updated instructions',
  })
  await skillsWrapper.vm.$nextTick()

  expect(window.api.skills.update).toHaveBeenCalledWith(store.config.workspaceId, 'skill_2', {
    name: 'Updated skill',
    description: 'Updated description',
    instructions: 'Updated instructions',
  })
  expect(listLoadSpy).toHaveBeenCalled()
})

test('readonly payload closes editor without create/update calls', async () => {
  await skillsWrapper.find('.emit-edit-readonly').trigger('click')
  const editor = skillsWrapper.findComponent({ name: 'SkillEditor' })
  editor.vm.$emit('skill-modified', { id: 'skill_1', readonly: true })
  await skillsWrapper.vm.$nextTick()

  expect(window.api.skills.create).not.toHaveBeenCalled()
  expect(window.api.skills.update).not.toHaveBeenCalled()
  expect(skillsWrapper.find('.editor.visible').exists()).toBe(false)
})

test('save error shows dialog and keeps editor open', async () => {
  window.api.skills.create = vi.fn(() => ({ success: false, error: 'Save failed' })) as any

  await skillsWrapper.find('.emit-create').trigger('click')
  const editor = skillsWrapper.findComponent({ name: 'SkillEditor' })
  editor.vm.$emit('skill-modified', {
    name: 'Broken skill',
    description: 'desc',
    instructions: 'instructions',
  })
  await skillsWrapper.vm.$nextTick()

  expect(Dialog.show).toHaveBeenCalled()
  expect(skillsWrapper.find('.editor.visible').exists()).toBe(true)
})

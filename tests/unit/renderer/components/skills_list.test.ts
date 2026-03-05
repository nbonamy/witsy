import { mount } from '@vue/test-utils'
import { beforeAll, beforeEach, expect, test, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import SkillsList from '@components/SkillsList.vue'
import { store } from '@services/store'
import { useWindowMock } from '@tests/mocks/window'

const stubs = {
  ContextMenuTrigger: defineComponent({
    name: 'ContextMenuTrigger',
    setup(_, { slots }) {
      return () => h('div', { class: 'context-menu-trigger-stub' }, slots.default?.())
    }
  }),
  ButtonIcon: defineComponent({
    name: 'ButtonIcon',
    emits: ['click'],
    setup(_, { slots, emit }) {
      return () => h('button', { class: 'button-icon-stub', onClick: () => emit('click') }, slots.default?.())
    }
  }),
  SpinningIcon: defineComponent({
    name: 'SpinningIcon',
    setup() {
      return () => h('span', 'spinner')
    }
  }),
}

beforeAll(() => {
  useWindowMock()
  store.loadSettings()
  store.load = () => {}
})

beforeEach(() => {
  vi.clearAllMocks()
  store.config.plugins.skills.enabled = true
  store.config.skills.locations = []
})

test('emits create when clicking new', async () => {
  window.api.skills.defaultLocations = vi.fn(() => ['/witsy/skills'])
  window.api.skills.list = vi.fn(() => [
    {
      id: 'skill_1',
      name: 'alpha',
      description: 'desc',
      rootPath: '/witsy/skills/alpha',
      skillMdPath: '/witsy/skills/alpha/SKILL.md',
    }
  ]) as any

  const wrapper = mount(SkillsList, { global: { stubs } })
  wrapper.vm.load()
  await wrapper.vm.$nextTick()

  await wrapper.find('button[name="new"]').trigger('click')
  expect(wrapper.emitted('create')).toBeTruthy()
})

test('emits editable draft for system skill', async () => {
  window.api.skills.defaultLocations = vi.fn(() => ['/witsy/skills'])
  window.api.skills.list = vi.fn(() => [
    {
      id: 'skill_1',
      name: 'alpha',
      description: 'desc',
      rootPath: '/witsy/skills/alpha',
      skillMdPath: '/witsy/skills/alpha/SKILL.md',
    }
  ]) as any
  window.api.skills.load = vi.fn(() => ({ instructions: '# alpha' })) as any

  const wrapper = mount(SkillsList, { global: { stubs } })
  wrapper.vm.load()
  await wrapper.vm.$nextTick()

  await wrapper.find('.skill-actions .button-icon-stub').trigger('click')
  expect(window.api.skills.load).toHaveBeenCalledWith(store.config.workspaceId, 'skill_1')
  expect(wrapper.emitted('edit')).toBeTruthy()
  expect(wrapper.emitted('edit')![0][0]).toMatchObject({
    id: 'skill_1',
    instructions: '# alpha',
    readonly: false,
  })
})

test('emits readonly draft for shared skill', async () => {
  window.api.skills.defaultLocations = vi.fn(() => ['/witsy/skills'])
  window.api.skills.list = vi.fn(() => [
    {
      id: 'skill_2',
      name: 'beta',
      description: 'desc',
      rootPath: '/external/skills/beta',
      skillMdPath: '/external/skills/beta/SKILL.md',
    }
  ]) as any
  window.api.skills.load = vi.fn(() => ({ instructions: '# beta' })) as any

  const wrapper = mount(SkillsList, { global: { stubs } })
  wrapper.vm.load()
  await wrapper.vm.$nextTick()

  await wrapper.find('.skill-actions .button-icon-stub').trigger('click')
  expect(wrapper.emitted('edit')).toBeTruthy()
  expect(wrapper.emitted('edit')![0][0]).toMatchObject({
    id: 'skill_2',
    instructions: '# beta',
    readonly: true,
  })
})

import { mount } from '@vue/test-utils'
import { beforeEach, expect, test, vi } from 'vitest'
import SkillEditor from '@components/SkillEditor.vue'
import Dialog from '@renderer/utils/dialog'

vi.mock('@renderer/utils/dialog', () => ({
  default: {
    alert: vi.fn(),
  }
}))

beforeEach(() => {
  vi.clearAllMocks()
})

test('emits skill-modified on save with trimmed name/description', async () => {
  const wrapper = mount(SkillEditor, {
    props: {
      skill: null,
      readonly: false,
    }
  })

  await wrapper.find('input[name="name"]').setValue('  My Skill  ')
  await wrapper.find('textarea[name="description"]').setValue('  Desc  ')
  await wrapper.find('textarea[name="instructions"]').setValue('Do this')
  await wrapper.find('button.default').trigger('click')

  expect(wrapper.emitted('skill-modified')).toBeTruthy()
  expect(wrapper.emitted('skill-modified')![0][0]).toEqual({
    id: undefined,
    name: 'My Skill',
    description: 'Desc',
    instructions: 'Do this',
  })
})

test('shows validation alert when required fields are missing', async () => {
  const wrapper = mount(SkillEditor, {
    props: {
      skill: null,
      readonly: false,
    }
  })

  await wrapper.find('button.default').trigger('click')

  expect(Dialog.alert).toHaveBeenCalled()
  expect(wrapper.emitted('skill-modified')).toBeFalsy()
})

test('readonly mode shows close only and cancel emits null', async () => {
  const wrapper = mount(SkillEditor, {
    props: {
      skill: {
        id: 'skill_1',
        name: 'Name',
        description: 'Desc',
        instructions: 'Instructions',
      },
      readonly: true,
    }
  })

  expect(wrapper.find('button.default').exists()).toBe(false)
  expect(wrapper.find('input[name="name"]').attributes('readonly')).toBeDefined()
  expect(wrapper.find('textarea[name="instructions"]').attributes('readonly')).toBeDefined()

  await wrapper.find('.buttons button').trigger('click')
  expect(wrapper.emitted('skill-modified')).toBeTruthy()
  expect(wrapper.emitted('skill-modified')![0][0]).toBeNull()
})

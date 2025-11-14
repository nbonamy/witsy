
import { vi, test, expect, afterAll } from 'vitest'
import { mount, enableAutoUnmount } from '@vue/test-utils'
import EditableText from '../../../../src/renderer/components/EditableText.vue'

enableAutoUnmount(afterAll)

let selection:Selection | null = null
// @ts-expect-error mock
window.getSelection = vi.fn(() => { return {
  ...selection,
  setBaseAndExtent: vi.fn((anchorNode, anchorOffset, focusNode, focusOffset) => {
    // @ts-expect-error mock
    selection = { anchorNode, anchorOffset, focusNode, focusOffset, isCollapsed: false }
  })
}})

test('Renders correctly', async () => {
  const wrapper = mount(EditableText)
  expect(wrapper.exists()).toBe(true)
  expect(wrapper.find('.placeholder').exists()).toBe(true)
  expect(wrapper.find('.content').exists()).toBe(true)
})

test('Can set content', async () => {
  const wrapper = mount(EditableText)
  wrapper.vm.setContent({ content: 'Hello\n\nBonjour', start: 0, end: 0 })
  await wrapper.vm.$nextTick()
  expect(wrapper.find('.placeholder').exists()).toBe(false)
  expect(wrapper.find('.content').element.innerHTML).toBe('<div><span>Hello</span></div><div><span>&nbsp;</span></div><div><span>Bonjour</span></div>')
})

test('Can get content', async () => {
  const wrapper = mount(EditableText)
  wrapper.vm.setContent({ content: 'Hello\nBonjour\n\nAdios', start: 0, end: 0 })
  await wrapper.vm.$nextTick()
  expect(wrapper.vm.getContent()).toStrictEqual({ content: 'Hello\nBonjour\n\nAdios', selection: null, cursor: null, start: null, end: null })
})

test('Can set selection', async () => {
  const wrapper = mount(EditableText)
  wrapper.vm.setContent({ content: 'Hello\nBonjour', start: 1, end: 3 })
  await wrapper.vm.$nextTick()
  expect(wrapper.find('.content').element.innerHTML).toBe('<div><span>H</span><span style="background-color: rgb(180, 215, 255);">el</span><span>lo</span></div><div><span>Bonjour</span></div>')
  wrapper.vm.setContent({ content: 'Hello\n\nBonjour\n', start: 1, end: 9 })
  await wrapper.vm.$nextTick()
  expect(wrapper.find('.content').element.innerHTML).toBe('<div><span>H</span><span style="background-color: rgb(180, 215, 255);">ello</span></div><div><span style="background-color: rgb(180, 215, 255);">&nbsp;</span></div><div><span style="background-color: rgb(180, 215, 255);">Bo</span><span>njour</span></div><div><span>&nbsp;</span></div>')
})

test('Can transform selection', async () => {
  const wrapper = mount(EditableText)
  wrapper.vm.setContent({ content: 'Hello\n\nBonjour', start: 0, end: 0 })
  const lines = wrapper.find('.content').findAll('div')
  window.getSelection()!.setBaseAndExtent(lines[0].element.childNodes[0].childNodes[0], 1, lines[2].element.childNodes[0].childNodes[0], 2);
  await wrapper.vm.$nextTick()
  await wrapper.find('.content').trigger('keyup')
  await wrapper.find('.content').trigger('blur')
  await wrapper.vm.$nextTick()
  expect(wrapper.find('.content').element.innerHTML).toBe('<div><span>H</span><span style="background-color: rgb(180, 215, 255);">ello&nbsp;</span></div><div><span style="background-color: rgb(180, 215, 255);">&nbsp;&nbsp;</span></div><div><span style="background-color: rgb(180, 215, 255);">Bo</span><span>njour</span></div>')
  //console.log(wrapper.vm.getContent().content.split('').map(c => `${c} = ${c.charCodeAt(0)}`))
  expect(wrapper.vm.getContent()).toStrictEqual({ content: 'Hello\n\nBonjour', selection: 'ello\n\nBo', start: 1, end: 9, cursor: null })
})

test('Cleans up on focus', async () => {
  const wrapper = mount(EditableText)
  wrapper.vm.setContent({ content: 'Hello\n\nBonjour', start: 1, end: 9 })
  await wrapper.vm.$nextTick()
  expect(wrapper.find('.content').element.innerHTML).toBe('<div><span>H</span><span style="background-color: rgb(180, 215, 255);">ello</span></div><div><span style="background-color: rgb(180, 215, 255);">&nbsp;</span></div><div><span style="background-color: rgb(180, 215, 255);">Bo</span><span>njour</span></div>')
  await wrapper.find('.content').trigger('focus')
  expect(wrapper.find('.content').element.innerHTML).toBe('<div><span>Hello</span></div><div><span>&nbsp;</span></div><div><span>Bonjour</span></div>')
})


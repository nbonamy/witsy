
import { vi, beforeEach, expect, test, afterAll } from 'vitest'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import Commands from '../../src/screens/Commands.vue'
import defaults from '../../defaults/settings.json'

enableAutoUnmount(afterAll)

window.api = {
  on: vi.fn(),
  config: {
    load: vi.fn(() => defaults),
  },
  commands: {
    load: vi.fn(() => [
      { id: 1, icon: '1', label: 'Command 1', shortcut: '1', action: 'chat_window', state: 'enabled' },
      { id: 2, icon: '2', label: 'Command 2', shortcut: '2', action: 'paste_below', state: 'enabled' },
      { id: 3, icon: '3', label: 'Command 3', shortcut: '3', action: 'paste_in_place', state: 'enabled' },
      { id: 4, icon: '4', label: 'Command 4', shortcut: '4', action: 'clipboard_copy', state: 'enabled' },
      { id: 5, icon: '5', label: 'Command 5', shortcut: '5', action: 'chat_window', state: 'disabled' },
    ]),
    run: vi.fn(),
    cancel: vi.fn(),
    closePalette: vi.fn(),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

test('Renders correctly', () => {
  const wrapper = mount(Commands)
  expect(wrapper.exists()).toBe(true)
  expect(wrapper.find('.commands').exists()).toBe(true)
  expect(wrapper.findAll('.command')).toHaveLength(4)

  for (let i=0; i<4; i++) {
    const command = wrapper.findAll('.command').at(i)
    expect(command.find('.icon').text()).toBe(`${i+1}`)
    expect(command.find('.label').text()).toBe(`Command ${i+1}`)
  }
})

// test('Closes on Escape', async () => {
//   const wrapper = mount(Commands)
//   await wrapper.trigger('keyup', { key: 'Escape' })
//   expect(window.api.commands.closePalette).toHaveBeenCalled()
// })

test('Runs command on click', async () => {
  const wrapper = mount(Commands, { props: { extra: { textId: 6 }}})
  const command = wrapper.findAll('.command').at(0)
  await command.trigger('click')
  expect(window.api.commands.run).toHaveBeenCalledWith({
    command: {
      action: 'chat_window',
      icon: '1',
      id: 1,
      shortcut: '1',
      label: 'Command 1',
      state: 'enabled',
    },
    textId: 6,
  })
})

// test('Runs command on shortcut', async () => {
//   const wrapper = mount(Commands, { props: { extra: { textId: 6 }}})
//   await wrapper.trigger('keyup', { key: '2' })
//   expect(window.api.commands.run).toHaveBeenCalledWith({
//     command: {
//       action: 'paste_below',
//       icon: '2',
//       id: 2,
//       shortcut: '2',
//       label: 'Command 2',
//       state: 'enabled',
//     },
//     textId: 6,
//   })
// })

// test('Uses chat on shift', async () => {
//   const wrapper = mount(Commands, { props: { extra: { textId: 6 }}})
//   await wrapper.trigger('keyup', { key: '3', shiftKey: true})
//   expect(window.api.commands.run).toHaveBeenCalledWith({
//     command: {
//       action: 'chat_window',
//       icon: '3',
//       id: 3,
//       shortcut: '3',
//       label: 'Command 3',
//       state: 'enabled',
//     },
//     textId: 6,
//   })

// })


import { vi, beforeAll, beforeEach, expect, test, afterAll } from 'vitest'
import { useWindowMock } from '../mocks/window'
import { enableAutoUnmount, mount, VueWrapper } from '@vue/test-utils'
import CommandPicker from '../../src/screens/CommandPicker.vue'

enableAutoUnmount(afterAll)

beforeAll(() => {
  useWindowMock()
})

beforeEach(() => {
  vi.clearAllMocks()
})

test('Renders correctly', async () => {
  const wrapper = mount(CommandPicker, { props: { extra: {  } } } )
  await wrapper.vm.$nextTick()
  expect(wrapper.exists()).toBe(true)
  expect(wrapper.find('.commands').exists()).toBe(true)
  expect(wrapper.findAll('.command')).toHaveLength(4)

  for (let i=0; i<4; i++) {
    const command = wrapper.findAll('.command').at(i)
    expect(command!.find('.icon').text()).toBe(`${i+1}`)
    expect(command!.find('.label').text()).toBe(`Command ${i+1}`)
  }
})

test('Closes on Escape', async () => {
  mount(CommandPicker, { props: { extra: { sourceApp: { id: 'appId', name: 'appName', path: 'appPath' } } } } )
  document.dispatchEvent(new KeyboardEvent('keyup', { key: 'Escape' }));
  expect(window.api.commands.closePicker).toHaveBeenLastCalledWith({ id: 'appId', name: 'appName', path: 'appPath' })
})

test('Changes selection on arrow keys', async () => {
  const wrapper = mount(CommandPicker, { props: { extra: {  } } } )
  await wrapper.vm.$nextTick()
  expect(wrapper.find('.selected .label').text()).toBe('Command 1')
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
  await wrapper.vm.$nextTick()
  expect(wrapper.find('.selected .label').text()).toBe('Command 2')
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
  await wrapper.vm.$nextTick()
  expect(wrapper.find('.selected .label').text()).toBe('Command 1')
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
  await wrapper.vm.$nextTick()
  expect(wrapper.find('.selected .label').text()).toBe('Command 1')
})

test('Runs on Enter', async () => {
  const wrapper = mount(CommandPicker, { props: { extra: { textId: 6, sourceApp: { id: 'appId', name: 'appName', path: 'appPath' } } } })
  await wrapper.vm.$nextTick()
  expect(wrapper.find('.selected .label').text()).toBe('Command 1')
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
  expect(window.api.commands.run).toHaveBeenLastCalledWith({
    textId: 6,
    sourceApp: { id: 'appId', name: 'appName', path: 'appPath' },
    command: {
      action: 'chat_window',
      icon: '1',
      id: 1,
      shortcut: '1',
      label: 'Command 1',
      state: 'enabled',
    },
  })
})

test('Runs command on click', async () => {
  const wrapper: VueWrapper<any> = mount(CommandPicker)
  wrapper.vm.onShow({ textId: 6, sourceApp: { id: 'appId', name: 'appName', path: 'appPath' } })
  await wrapper.vm.$nextTick()
  const command = wrapper.findAll('.command').at(0)
  await command!.trigger('click')
  expect(window.api.commands.run).toHaveBeenLastCalledWith({
    textId: 6,
    sourceApp: { id: 'appId', name: 'appName', path: 'appPath' },
    command: {
      action: 'chat_window',
      icon: '1',
      id: 1,
      shortcut: '1',
      label: 'Command 1',
      state: 'enabled',
    },
  })
})

test('Runs command on click', async () => {
  const wrapper = mount(CommandPicker, { props: { extra: { textId: 6, sourceApp: { id: 'appId', name: 'appName', path: 'appPath' } }}})
  await wrapper.vm.$nextTick()
  const command = wrapper.findAll('.command').at(0)
  await command!.trigger('click')
  expect(window.api.commands.run).toHaveBeenLastCalledWith({
    textId: 6,
    sourceApp: { id: 'appId', name: 'appName', path: 'appPath' },
    command: {
      action: 'chat_window',
      icon: '1',
      id: 1,
      shortcut: '1',
      label: 'Command 1',
      state: 'enabled',
    },
  })
})

// test('Runs command on shortcut', async () => {
//   const wrapper = mount(Commands, { props: { extra: { textId: 6 }}})
//   await wrapper.trigger('keyup', { key: '2' })
//   expect(window.api.commands.run).toHaveBeenLastCalledWith({
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
//   expect(window.api.commands.run).toHaveBeenLastCalledWith({
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

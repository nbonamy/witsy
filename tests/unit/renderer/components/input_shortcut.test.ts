
import { vi, beforeAll, expect, test, beforeEach, afterAll, describe } from 'vitest'
import { mount, VueWrapper, enableAutoUnmount } from '@vue/test-utils'
import { useWindowMock } from '@tests/mocks/window'
import InputShortcut from '@components/InputShortcut.vue'

enableAutoUnmount(afterAll)

let wrapper: VueWrapper<any>

beforeAll(() => {
  useWindowMock()
})

beforeEach(() => {
  wrapper = mount(InputShortcut, {
    props: {
      onChange: vi.fn(),
    }
  })
})

test('Create', async () => {
  expect(wrapper.exists()).toBe(true)
  expect(wrapper.find('input').exists()).toBe(true)
})

test('Input value', async () => {
  expect(wrapper.find('input').element.value).toBe('')
  await wrapper.find('input').trigger('keydown', { code: 'Space', key: ' ', keyCode: 32, ctrlKey: true })
  expect(wrapper.find('input').element.value).toBe('⌃Space')
  await wrapper.find('input').trigger('keydown', { code: 'Enter', key: 'Enter', keyCode: 13, shiftKey: true, ctrlKey: true })
  expect(wrapper.find('input').element.value).toBe('⌃⇧Enter')
})

test('Delete value with backspace', async () => {
  await wrapper.find('input').trigger('keydown', { code: 'Space', key: ' ', keyCode: 32, ctrlKey: true })
  expect(wrapper.find('input').element.value).not.toBe('')
  await wrapper.find('input').trigger('keydown', { code: 'Backspace', key: 'Backspace', keyCode: 8 })
  expect(wrapper.find('input').element.value).toBe('')
  expect(wrapper.emitted().change).toBeTruthy()
})

test('Delete value with icon', async () => {
  await wrapper.find('input').trigger('keydown', { code: 'Space', key: ' ', keyCode: 32, ctrlKey: true })
  expect(wrapper.find('input').element.value).not.toBe('')
  await wrapper.find('.clear').trigger('click')
  expect(wrapper.find('input').element.value).toBe('')
  expect(wrapper.vm.value).toStrictEqual({ type: 'electron', key: 'none' })
  expect(wrapper.emitted().change).toBeTruthy()
})

test('Invalid shortcuts', async () => {
  await wrapper.find('input').trigger('keydown', { code: 'Space', key: ' ', keyCode: 32 })
  expect(wrapper.find('input').element.value).toBe('')
  await wrapper.find('input').trigger('keydown', { code: 'Space', key: ' ', keyCode: 17, ctrlKey: true })
  expect(wrapper.find('input').element.value).toBe('')
  await wrapper.find('input').trigger('keydown', { code: 'Shift', key: ' ', keyCode: 32, ctrlKey: true })
  expect(wrapper.find('input').element.value).toBe('')
})

// Native shortcut tests (acceptNative: true)
describe('Native shortcuts', () => {

  let nativeWrapper: VueWrapper<any>

  beforeEach(() => {
    nativeWrapper = mount(InputShortcut, {
      props: {
        acceptNative: true,
        onChange: vi.fn(),
      }
    })
  })

  test('Right Command modifier-only shortcut', async () => {
    await nativeWrapper.find('input').trigger('keydown', { code: 'MetaRight', key: 'Meta', keyCode: 93, metaKey: true })
    expect(nativeWrapper.find('input').element.value).toBe('Right ⌘')
    expect(nativeWrapper.vm.value).toStrictEqual({ type: 'native', rightCommand: true })
    expect(nativeWrapper.emitted().change).toBeTruthy()
  })

  test('Right Shift modifier-only shortcut', async () => {
    await nativeWrapper.find('input').trigger('keydown', { code: 'ShiftRight', key: 'Shift', keyCode: 16, shiftKey: true })
    expect(nativeWrapper.find('input').element.value).toBe('Right ⇧')
    expect(nativeWrapper.vm.value).toStrictEqual({ type: 'native', rightShift: true })
  })

  test('Right Option modifier-only shortcut', async () => {
    await nativeWrapper.find('input').trigger('keydown', { code: 'AltRight', key: 'Alt', keyCode: 18, altKey: true })
    expect(nativeWrapper.find('input').element.value).toBe('Right ⌥')
    expect(nativeWrapper.vm.value).toStrictEqual({ type: 'native', rightOption: true })
  })

  test('Right Control modifier-only shortcut', async () => {
    await nativeWrapper.find('input').trigger('keydown', { code: 'ControlRight', key: 'Control', keyCode: 17, ctrlKey: true })
    expect(nativeWrapper.find('input').element.value).toBe('Right ⌃')
    expect(nativeWrapper.vm.value).toStrictEqual({ type: 'native', rightControl: true })
  })

  test('Left modifier combo (Command + Option)', async () => {
    // Simulate pressing two left modifiers
    await nativeWrapper.find('input').trigger('keydown', {
      code: 'MetaLeft',
      key: 'Meta',
      keyCode: 91,
      metaKey: true,
      altKey: true
    })
    expect(nativeWrapper.find('input').element.value).toBe('⌥⌘')
    expect(nativeWrapper.vm.value).toStrictEqual({ type: 'native', leftCommand: true, leftOption: true })
  })

  test('Left modifier combo (Shift + Control)', async () => {
    await nativeWrapper.find('input').trigger('keydown', {
      code: 'ShiftLeft',
      key: 'Shift',
      keyCode: 16,
      shiftKey: true,
      ctrlKey: true
    })
    expect(nativeWrapper.find('input').element.value).toBe('⌃⇧')
    expect(nativeWrapper.vm.value).toStrictEqual({ type: 'native', leftShift: true, leftControl: true })
  })

  test('Single left modifier alone is ignored', async () => {
    await nativeWrapper.find('input').trigger('keydown', {
      code: 'MetaLeft',
      key: 'Meta',
      keyCode: 91,
      metaKey: true
    })
    // Single left modifier should not register
    expect(nativeWrapper.find('input').element.value).toBe('')
    expect(nativeWrapper.emitted().change).toBeFalsy()
  })

  test('Delete clears to empty native shortcut', async () => {
    // First set a native shortcut
    await nativeWrapper.find('input').trigger('keydown', { code: 'MetaRight', key: 'Meta', keyCode: 93, metaKey: true })
    expect(nativeWrapper.find('input').element.value).toBe('Right ⌘')

    // Delete with backspace
    await nativeWrapper.find('input').trigger('keydown', { code: 'Backspace', key: 'Backspace', keyCode: 8 })
    expect(nativeWrapper.find('input').element.value).toBe('')
    expect(nativeWrapper.vm.value).toStrictEqual({ type: 'native' })
  })

  test('Delete with icon clears to empty native shortcut', async () => {
    // First set a native shortcut
    await nativeWrapper.find('input').trigger('keydown', { code: 'MetaRight', key: 'Meta', keyCode: 93, metaKey: true })
    expect(nativeWrapper.find('input').element.value).not.toBe('')

    // Delete with icon
    await nativeWrapper.find('.clear').trigger('click')
    expect(nativeWrapper.find('input').element.value).toBe('')
    expect(nativeWrapper.vm.value).toStrictEqual({ type: 'native' })
  })

  test('Electron shortcut with modifier + key still works in native mode', async () => {
    // Regular modifier + key should still create electron shortcut
    await nativeWrapper.find('input').trigger('keydown', { code: 'KeyD', key: 'd', keyCode: 68, metaKey: true })
    expect(nativeWrapper.find('input').element.value).toBe('⌘D')
    expect(nativeWrapper.vm.value).toStrictEqual({ type: 'electron', key: 'D', alt: false, shift: false, ctrl: false, meta: true })
  })

  test('Display existing native shortcut with key', async () => {
    // Mount with an existing native shortcut that has a key
    const wrapper2 = mount(InputShortcut, {
      props: {
        acceptNative: true,
        modelValue: { type: 'native', leftCommand: true, key: 'D' }
      }
    })
    expect(wrapper2.find('input').element.value).toBe('⌘D')
  })

})

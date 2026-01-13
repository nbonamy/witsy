
import { vi, beforeAll, afterAll, afterEach, test, expect } from 'vitest'
import { mount, enableAutoUnmount } from '@vue/test-utils'
import { useWindowMock } from '@tests/mocks/window'
import ModalDialog from '@components/ModalDialog.vue'

enableAutoUnmount(afterAll)

beforeAll(() => {
  useWindowMock()
})

// Clean up teleported content after each test
afterEach(() => {
  document.body.innerHTML = ''
})

const mountDialog = (props = {}, slots = {}) => {
  return mount(ModalDialog, {
    props: {
      id: 'test-dialog',
      ...props
    },
    slots: {
      header: '<span>Test Title</span>',
      body: '<p>Test Body</p>',
      footer: '<button class="primary">OK</button>',
      ...slots
    },
    attachTo: document.body
  })
}

// Helper to query teleported content
const findInBody = (selector: string) => document.body.querySelector(selector)

test('Renders correctly when hidden', async () => {
  mountDialog()
  const dialog = findInBody('.dialog')
  expect(dialog).not.toBeNull()
  expect(dialog?.classList.contains('visible')).toBe(false)
})

test('Shows dialog when show() is called', async () => {
  const wrapper = mountDialog()
  await wrapper.vm.show()
  const dialog = findInBody('.dialog')
  expect(dialog?.classList.contains('visible')).toBe(true)
  expect(dialog?.classList.contains('modal-backdrop')).toBe(true)
})

test('Hides dialog when close() is called', async () => {
  const wrapper = mountDialog()
  await wrapper.vm.show()
  const dialog = findInBody('.dialog')
  expect(dialog?.classList.contains('visible')).toBe(true)
  wrapper.vm.close()
  await wrapper.vm.$nextTick()
  expect(dialog?.classList.contains('visible')).toBe(false)
})

test('Renders header slot', async () => {
  const wrapper = mountDialog()
  await wrapper.vm.show()
  const title = findInBody('.modal-title')
  expect(title?.textContent).toBe('Test Title')
})

test('Renders body slot', async () => {
  const wrapper = mountDialog()
  await wrapper.vm.show()
  const body = findInBody('.modal-body')
  expect(body?.textContent).toBe('Test Body')
})

test('Renders footer slot', async () => {
  const wrapper = mountDialog()
  await wrapper.vm.show()
  const button = findInBody('.modal-actions button')
  expect(button?.textContent).toBe('OK')
})

test('Shows icon for alert type', async () => {
  const wrapper = mountDialog({ type: 'alert', icon: true })
  await wrapper.vm.show()
  expect(findInBody('.modal-icon')).not.toBeNull()
  expect(findInBody('.modal-icon img')).not.toBeNull()
})

test('Hides icon for window type', async () => {
  const wrapper = mountDialog({ type: 'window', icon: true })
  await wrapper.vm.show()
  expect(findInBody('.modal-icon')).toBeNull()
})

test('Hides icon when icon prop is false', async () => {
  const wrapper = mountDialog({ type: 'alert', icon: false })
  await wrapper.vm.show()
  expect(findInBody('.modal-icon')).toBeNull()
})

test('Closes on Escape key when dismissible', async () => {
  const wrapper = mountDialog({ dismissible: true })
  await wrapper.vm.show()
  const dialog = findInBody('.dialog')
  expect(dialog?.classList.contains('visible')).toBe(true)

  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
  await wrapper.vm.$nextTick()

  expect(dialog?.classList.contains('visible')).toBe(false)
})

test('Does not close on Escape key when not dismissible', async () => {
  const wrapper = mountDialog({ dismissible: false })
  await wrapper.vm.show()
  const dialog = findInBody('.dialog')
  expect(dialog?.classList.contains('visible')).toBe(true)

  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
  await wrapper.vm.$nextTick()

  expect(dialog?.classList.contains('visible')).toBe(true)
})

test('Emits save on Enter key when enterSaves is true', async () => {
  const wrapper = mountDialog({ enterSaves: true })
  await wrapper.vm.show()

  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
  await wrapper.vm.$nextTick()

  expect(wrapper.emitted('save')).toHaveLength(1)
})

test('Does not emit save on Enter key when enterSaves is false', async () => {
  const wrapper = mountDialog({ enterSaves: false })
  await wrapper.vm.show()

  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
  await wrapper.vm.$nextTick()

  expect(wrapper.emitted('save')).toBeUndefined()
})

test('Does not emit save on Enter in textarea without text-textarea class', async () => {
  const wrapper = mountDialog({ enterSaves: true }, {
    body: '<textarea id="test-textarea"></textarea>'
  })
  await wrapper.vm.show()

  const textarea = findInBody('#test-textarea') as HTMLTextAreaElement
  textarea?.focus()

  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
  await wrapper.vm.$nextTick()

  expect(wrapper.emitted('save')).toBeUndefined()
})

test('Emits save on Enter in textarea with text-textarea class', async () => {
  const wrapper = mountDialog({ enterSaves: true }, {
    body: '<textarea id="test-textarea" class="text-textarea"></textarea>'
  })
  await wrapper.vm.show()

  const textarea = findInBody('#test-textarea') as HTMLTextAreaElement
  textarea?.focus()

  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
  await wrapper.vm.$nextTick()

  expect(wrapper.emitted('save')).toHaveLength(1)
})

test('Applies custom width', async () => {
  const wrapper = mountDialog({ width: '500px' })
  await wrapper.vm.show()

  const popup = findInBody('.modal-popup') as HTMLElement
  expect(popup?.style.width).toContain('500px')
  expect(popup?.style.maxWidth).toContain('500px')
})

test('Applies custom height to body', async () => {
  const wrapper = mountDialog({ height: '300px' })
  await wrapper.vm.show()

  const body = findInBody('.modal-body') as HTMLElement
  expect(body?.style.height).toContain('300px')
})

test('Applies form-vertical class when form is vertical', async () => {
  const wrapper = mountDialog({ form: 'vertical' })
  await wrapper.vm.show()

  const popup = findInBody('.modal-popup')
  expect(popup?.classList.contains('form-vertical')).toBe(true)
})

test('Does not apply form-vertical class when form is horizontal', async () => {
  const wrapper = mountDialog({ form: 'horizontal' })
  await wrapper.vm.show()

  const popup = findInBody('.modal-popup')
  expect(popup?.classList.contains('form-vertical')).toBe(false)
})

test('Focuses first input on show', async () => {
  const wrapper = mountDialog({}, {
    body: '<input id="test-input" type="text" />'
  })
  await wrapper.vm.show()

  expect(document.activeElement).toBe(findInBody('#test-input'))
})

test('Focuses textarea over input when both present', async () => {
  const wrapper = mountDialog({}, {
    body: '<input id="test-input" type="text" /><textarea id="test-textarea"></textarea>'
  })
  await wrapper.vm.show()

  expect(document.activeElement).toBe(findInBody('#test-textarea'))
})

test('Moves buttons out of .buttons container for backwards compatibility', async () => {
  const wrapper = mountDialog({}, {
    footer: '<div class="buttons"><button class="btn1">One</button><button class="btn2">Two</button></div>'
  })
  await wrapper.vm.show()

  // Buttons should be moved out of .buttons container
  expect(findInBody('.modal-actions .buttons')).toBeNull()
  expect(findInBody('.modal-actions .btn1')).not.toBeNull()
  expect(findInBody('.modal-actions .btn2')).not.toBeNull()
})

test('Removes keydown listener on close', async () => {
  const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener')
  const wrapper = mountDialog()

  await wrapper.vm.show()
  wrapper.vm.close()

  expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function))
  removeEventListenerSpy.mockRestore()
})

test('Sets dialog id from prop', async () => {
  mountDialog({ id: 'my-custom-dialog' })
  expect(findInBody('#my-custom-dialog')).not.toBeNull()
})

test('Applies type class when visible', async () => {
  const wrapper = mountDialog({ type: 'window' })
  await wrapper.vm.show()

  const dialog = findInBody('.dialog')
  expect(dialog?.classList.contains('window')).toBe(true)
})

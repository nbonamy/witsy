
import { vi, beforeAll, test, expect } from 'vitest'
import { useWindowMock } from '../mocks/window'
import { store } from '../../src/services/store'
import Dialog from '../../src/composables/dialog'
import Swal from 'sweetalert2/dist/sweetalert2.js'

vi.mock('sweetalert2/dist/sweetalert2.js', async () => {
  const Swal = vi.fn()
  Swal.fire = vi.fn(() => Promise.resolve({ isConfirmed: true, isDenied: false, isDismissed: false }))
  return { default: Swal }
})

beforeAll(() => {
  useWindowMock({ dialogResponse: 1})
  store.loadSettings()
  store.config.general.tips.conversation = false
})

test('Basic confirm', () => {
  Dialog.alert('Hello')
  expect(window.api.showDialog).toHaveBeenCalledWith({
    type: 'none',
    message: 'Hello',
    detail: undefined,
    buttons: [ 'OK' ],
    defaultId: 0,
    cancelId: -1,
  })
})

test('Confirm/Cancel', () => {
  Dialog.show({ title: 'Hello', text: 'World', showCancelButton: true, confirmButtonText: 'Yes' })
  expect(window.api.showDialog).toHaveBeenCalledWith({
    type: 'none',
    message: 'Hello',
    detail: 'World',
    buttons: [ 'Yes', 'Cancel' ],
    defaultId: 0,
    cancelId: 1,
  })
})

test('Confirm/Deny/Cancel', () => {
  Dialog.show({ title: 'Hello', text: 'World', showCancelButton: true, showDenyButton: true, confirmButtonText: 'Yes', denyButtonText: 'No', cancelButtonText: 'Cancel' })
  expect(window.api.showDialog).toHaveBeenCalledWith({
    type: 'none',
    message: 'Hello',
    detail: 'World',
    buttons: [ 'Yes', 'No', 'Cancel' ],
    defaultId: 0,
    cancelId: 2,
  })
})

test('Input', () => {
  Dialog.show({ title: 'Hello', text: 'World', input: 'text' })
  expect(Swal.fire).toHaveBeenCalledWith({
    customClass: {
      cancelButton: 'alert-neutral',
      denyButton: 'alert-danger',
      confirmButton: 'alert-neutral',
    },
    iconHtml: '<img src="">',
    input: 'text',
    text: 'World',
    title: 'Hello',
    willOpen: expect.any(Function),
  })
})


import { vi, beforeAll, beforeEach, test, expect } from 'vitest'
import { useWindowMock } from '../mocks/window'
import { store } from '../../src/services/store'
import Dialog from '../../src/composables/dialog'
import Swal from 'sweetalert2/dist/sweetalert2.js'

vi.mock('../../src/services/i18n', async () => {
  return {
    t: (key: string) => key,
  }
})

vi.mock('sweetalert2/dist/sweetalert2.js', async () => {
  return { default: {
    fire: vi.fn(() => Promise.resolve({
      isConfirmed: true,
      isDenied: false,
      isDismissed: false,
    }))
  }}
})

beforeAll(() => {
  useWindowMock({ dialogResponse: 1})
  store.loadSettings()
  store.config.general.tips.conversation = false
})

beforeEach(() => {
  vi.clearAllMocks()
})

test('Basic confirm', () => {
  Dialog.alert('Hello')
  expect(Swal.fire).toHaveBeenLastCalledWith({
    target: expect.any(HTMLElement),
    iconHtml: '<img src="">',
    confirmButtonText: 'common.ok',
    title: 'Hello',
    text: undefined,
    customClass: {
      'cancelButton': 'alert-neutral',
      'confirmButton': 'alert-neutral',
      'denyButton': 'alert-danger',
      'popup': 'form form-large',
    },
    didOpen: expect.any(Function),
    willOpen: expect.any(Function),
  })
})

test('Confirm/Cancel', () => {
  Dialog.show({ title: 'Hello', text: 'World', showCancelButton: true, confirmButtonText: 'Yes' })
  expect(Swal.fire).toHaveBeenLastCalledWith(expect.objectContaining({
    confirmButtonText: 'Yes',
    cancelButtonText: 'common.cancel',
    showCancelButton: true,
    title: 'Hello',
    text: 'World',
  }))
})

test('Confirm/Deny/Cancel', () => {
  Dialog.show({ title: 'Hello', text: 'World', showCancelButton: true, showDenyButton: true, confirmButtonText: 'Da', denyButtonText: 'Nein', cancelButtonText: 'Abbrechen' })
  expect(Swal.fire).toHaveBeenLastCalledWith(expect.objectContaining({
    showCancelButton: true,
    showDenyButton: true,
    confirmButtonText: 'Da',
    denyButtonText: 'Nein',
    cancelButtonText: 'Abbrechen',
    title: 'Hello',
    text: 'World',
  }))
})

test('Input Text', () => {
  Dialog.show({ title: 'Hello', text: 'World', input: 'text' })
  expect(Swal.fire).toHaveBeenLastCalledWith({
    target: expect.any(HTMLElement),
    customClass: expect.objectContaining({
      input: 'text-textarea',
    }),
    iconHtml: '<img src="">',
    input: 'textarea',
    text: 'World',
    title: 'Hello',
    confirmButtonText: 'common.ok',
    willOpen: expect.any(Function),
    didOpen: expect.any(Function),
  })
})

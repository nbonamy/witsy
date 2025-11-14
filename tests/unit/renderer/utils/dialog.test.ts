
import { vi, beforeAll, beforeEach, test, expect } from 'vitest'
import { useWindowMock } from '../../../mocks/window'
import { createI18nMock } from '../../../mocks'
import { store } from '../../../../src/renderer/services/store'
import Swal from 'sweetalert2/dist/sweetalert2.js'

// Restore the real Dialog module for this test since we're testing Dialog itself
vi.unmock('../../../../src/renderer/utils/dialog')
import Dialog from '../../../../src/renderer/utils/dialog'

vi.mock('../../../../src/renderer/services/i18n', async () => {
  return createI18nMock()
})

vi.mock('sweetalert2/dist/sweetalert2.js', async () => {
  return { default: {
    isVisible: vi.fn(() => false),
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
    iconHtml: undefined,
    confirmButtonText: 'common.ok',
    title: 'Hello',
    text: undefined,
    customClass: {
      'cancelButton': 'tertiary',
      'confirmButton': 'primary',
      'denyButton': 'secondary',
      'popup': 'form form-large',
    },
    didOpen: expect.any(Function),
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
    iconHtml: undefined,
    input: 'textarea',
    text: 'World',
    title: 'Hello',
    confirmButtonText: 'common.ok',
    didOpen: expect.any(Function),
  })
})

test('Swal already visible with cancel button - confirm', async () => {
  vi.mocked(Swal.isVisible).mockReturnValue(true)
  vi.spyOn(window, 'confirm').mockReturnValue(true)

  const result = await Dialog.show({
    title: 'Test',
    text: 'Message',
    showCancelButton: true
  })

  expect(window.confirm).toHaveBeenCalledWith('Test\n\nMessage')
  expect(result).toEqual({
    isConfirmed: true,
    isDenied: false,
    isDismissed: false
  })
})

test('Swal already visible with cancel button - cancel', async () => {
  vi.mocked(Swal.isVisible).mockReturnValue(true)
  vi.spyOn(window, 'confirm').mockReturnValue(false)

  const result = await Dialog.show({
    title: 'Test',
    text: 'Message',
    showCancelButton: true
  })

  expect(result).toEqual({
    isConfirmed: false,
    isDenied: false,
    isDismissed: true
  })
})

test('Swal already visible without buttons - alert', async () => {
  vi.mocked(Swal.isVisible).mockReturnValue(true)
  vi.spyOn(window, 'alert').mockReturnValue()

  const result = await Dialog.show({
    title: 'Test',
    text: 'Message'
  })

  expect(window.alert).toHaveBeenCalledWith('Test\n\nMessage')
  expect(result).toEqual({
    isConfirmed: true,
    isDenied: false,
    isDismissed: false
  })
})

test('Swal already visible with deny button - error', async () => {
  vi.mocked(Swal.isVisible).mockReturnValue(true)

  await expect(Dialog.show({
    title: 'Test',
    showDenyButton: true
  })).rejects.toThrow('Cannot open a new dialog while another one is open with deny button')
})

test('Swal initially visible but closes - retry', async () => {
  vi.mocked(Swal.isVisible)
    .mockReturnValueOnce(true)
    .mockReturnValueOnce(false)

  vi.useFakeTimers()

  const promise = Dialog.show({ title: 'Test' })

  await vi.advanceTimersByTimeAsync(250)
  await promise

  expect(Swal.fire).toHaveBeenCalled()
  vi.useRealTimers()
})

// Note: didOpen/didClose callback tests would require complex Swal mock setup
// These are better tested through integration/E2E tests
// The critical paths (fallback dialogs, button handling, etc.) are well covered above

test('waitUntilClosed - immediately if not visible', async () => {
  vi.mocked(Swal.isVisible).mockReturnValue(false)

  await Dialog.waitUntilClosed()

  expect(Swal.isVisible).toHaveBeenCalled()
})

test('waitUntilClosed - wait until closes', async () => {
  vi.mocked(Swal.isVisible)
    .mockReturnValueOnce(true)
    .mockReturnValueOnce(true)
    .mockReturnValue(false)

  vi.useFakeTimers()

  const promise = Dialog.waitUntilClosed()

  await vi.advanceTimersByTimeAsync(100)
  await promise

  expect(Swal.isVisible).toHaveBeenCalledTimes(3)
  vi.useRealTimers()
})

import { config } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { vTooltip } from './src/renderer/directives/tooltip'
import { vi } from 'vitest'

const i18n = createI18n({
  legacy: false,
  allowComposition: true
})
i18n.global.t = key => key

config.global.plugins = [i18n]

config.global.directives = {
  tooltip: vTooltip
}

// Mock SweetAlert2 to prevent DOM-related errors in tests
vi.mock('sweetalert2/dist/sweetalert2.js', () => ({
  default: {
    fire: vi.fn(() => Promise.resolve({ isConfirmed: true, isDenied: false, isDismissed: false })),
    isVisible: vi.fn(() => false),
    close: vi.fn(),
    mixin: vi.fn(() => ({
      fire: vi.fn(() => Promise.resolve({ isConfirmed: true, isDenied: false, isDismissed: false }))
    }))
  }
}))

// Mock Dialog service to prevent SweetAlert2 DOM-related errors in tests
vi.mock('./src/renderer/utils/dialog', () => ({
  default: {
    alert: vi.fn(() => Promise.resolve({
      isConfirmed: true,
      isDenied: false,
      isDismissed: false,
    })),
    show: vi.fn(() => Promise.resolve({
      isConfirmed: true,
      isDenied: false,
      isDismissed: false,
    })),
  }
}))

// Mock EventBus composable
const onBusEventMock = vi.fn()
const emitBusEventMock = vi.fn()

vi.mock('./src/renderer/composables/event_bus', () => ({
  default: () => ({
    onBusEvent: onBusEventMock,
    emitBusEvent: emitBusEventMock
  })
}))

// Export mock functions for individual test access
export { onBusEventMock, emitBusEventMock }

// Mock ChatCallbacks for provide/inject
export const chatCallbacksMock = {
  onDeleteChat: vi.fn(),
  onDeleteFolder: vi.fn(),
  onDeleteMessage: vi.fn(),
  onForkChat: vi.fn(),
  onMoveChat: vi.fn(),
  onNewChat: vi.fn(),
  onNewChatInFolder: vi.fn(),
  onRenameChat: vi.fn(),
  onRenameFolder: vi.fn(),
  onResendAfterEdit: vi.fn(),
  onRetryGeneration: vi.fn(),
  onRunAgent: vi.fn(),
  onSelectChat: vi.fn(),
  onSetPrompt: vi.fn(),
}

// Helper to merge mount options with chat-callbacks provided
export const withChatCallbacks = (options: any = {}) => ({
  ...options,
  global: {
    ...options.global,
    provide: {
      ...options.global?.provide,
      'chat-callbacks': chatCallbacksMock
    }
  }
})

// Mock Automator class
vi.mock('./src/main/automations/automator', () => {
  const Automator = vi.fn()
  Automator.prototype.getForemostApp = vi.fn(() => ({ id: 'appId', name: 'appName', path: 'appPath', window: 'title' }))
  Automator.prototype.moveCaretBelow = vi.fn()
  Automator.prototype.getSelectedText = vi.fn(() => Promise.resolve('Grabbed text') as Promise<string | null>)
  Automator.prototype.getForemostApp = vi.fn(() => Promise.resolve({
    id: 'appId',
    name: 'appName', 
    path: 'appPath',
    window: 'title'
  }))
  Automator.prototype.pasteText = vi.fn()
  return { default: Automator }
})

// Mock IconPicker to avoid rendering 1500+ lucide icons in tests
vi.mock('./src/renderer/components/IconPicker.vue', () => ({
  default: {
    name: 'IconPicker',
    template: '<div class="icon-picker-mock"></div>',
    props: ['modelValue'],
    emits: ['update:modelValue'],
  }
}))

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

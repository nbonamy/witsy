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
vi.mock('./src/renderer/composables/dialog', () => ({
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
const onEventMock = vi.fn()
const emitEventMock = vi.fn()

vi.mock('./src/renderer/composables/event_bus', () => ({
  default: () => ({
    onEvent: onEventMock,
    emitEvent: emitEventMock
  })
}))

// Export mock functions for individual test access
export { onEventMock, emitEventMock }

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

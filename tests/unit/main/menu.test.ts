
import { test, expect, vi } from 'vitest'
import { app, Menu } from 'electron'
import { installMenu } from '@main/menu'

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => ''),
    getLocale: vi.fn(() => 'en-US'),
  },
  BrowserWindow: {
    getAllWindows: vi.fn(() => []),
    getFocusedWindow: vi.fn(() => null)
  },
  Menu: {
    buildFromTemplate: vi.fn(() => { return {}}),
    setApplicationMenu: vi.fn()
  },
  safeStorage: {
    isEncryptionAvailable: vi.fn(() => true),
    encryptString: vi.fn((data) => `encrypted-${data}`),
    decryptString: vi.fn((data) => data.toString('latin1'))
  },
}))

test('installMenu', () => {
  installMenu(app, {
    quit: vi.fn(),
    checkForUpdates: vi.fn(),
    quickPrompt: vi.fn(),
    openMain: vi.fn(),
    scratchpad: vi.fn(),
    settings: vi.fn(),
    studio: vi.fn(),
    forge: vi.fn(),
    backupExport: vi.fn(),
    backupImport: vi.fn(),
    importOpenAI: vi.fn(),
  }, null)
  expect(Menu.buildFromTemplate).toHaveBeenCalled()
  expect(Menu.setApplicationMenu).toHaveBeenLastCalledWith({})
})

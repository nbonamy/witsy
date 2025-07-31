
import { test, expect, vi } from 'vitest'
import { app, Menu } from 'electron'
import { installMenu } from '../../src/main/menu'

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
  }
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
  }, null)
  expect(Menu.buildFromTemplate).toHaveBeenCalled()
  expect(Menu.setApplicationMenu).toHaveBeenLastCalledWith({})
})

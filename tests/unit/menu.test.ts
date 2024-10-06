
import { test, expect, vi } from 'vitest'
import { app, Menu } from 'electron'
import { installMenu } from '../../src/main/menu'

vi.mock('electron', () => ({
  app: { },
  Menu: {
    buildFromTemplate: vi.fn(() => { return {}}),
    setApplicationMenu: vi.fn()
  }
}))

test('installMenu', () => {
  installMenu(app, {
    quit: vi.fn(),
    checkForUpdates: vi.fn(),
    newChat: vi.fn(),
    settings: vi.fn(),
  }, null)
  expect(Menu.buildFromTemplate).toHaveBeenCalled()
  expect(Menu.setApplicationMenu).toHaveBeenCalledWith({})
})

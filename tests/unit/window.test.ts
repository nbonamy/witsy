
import { vi, beforeEach, expect, test } from 'vitest'
import { BrowserWindow } from 'electron'
import * as window from '../../src/main/window'

global.MAIN_WINDOW_VITE_DEV_SERVER_URL = 'http://localhost:3000/'
global.MAIN_WINDOW_VITE_NAME = 'vite'

vi.mock('electron', async () => {
  const BrowserWindow = vi.fn()
  BrowserWindow.prototype.visible = true
  BrowserWindow.prototype.destroyed = false
  BrowserWindow.prototype.minimized = false
  BrowserWindow.prototype.show = vi.fn()
  BrowserWindow.prototype.hide = vi.fn(() => this.visible = false)
  BrowserWindow.prototype.close = vi.fn(() => this.destroyed = true)
  BrowserWindow.prototype.focus = vi.fn()
  BrowserWindow.prototype.restore = vi.fn(() => this.minimized = false)
  BrowserWindow.prototype.minimize = vi.fn(() => this.minimized = true)
  BrowserWindow.prototype.isMinimized = vi.fn(() => this.minimized)
  BrowserWindow.prototype.isVisible = vi.fn(() => this.visible)
  BrowserWindow.prototype.isDestroyed = vi.fn(() => false)
  BrowserWindow.prototype.loadFile = vi.fn()
  BrowserWindow.prototype.loadURL = vi.fn()
  BrowserWindow.prototype.on = vi.fn()
  BrowserWindow.prototype.once = vi.fn()
  BrowserWindow.prototype.setBounds = vi.fn()
  BrowserWindow.prototype.setSize = vi.fn()
  BrowserWindow.prototype.getSize = vi.fn(() => [0, 0])
  BrowserWindow.getAllWindows = vi.fn(() => {
    const window1 = new BrowserWindow()
    const window2 = new BrowserWindow()
    const window3 = new BrowserWindow()
    const window4 = new BrowserWindow()
    //window4.minimize()
    for (const window of [window1, window2, window3, window4]) {
      console.log(window.isVisible())
    }
    window3.hide()
    for (const window of [window1, window2, window3, window4]) {
      console.log(window.isVisible())
    }
    return [window1, window2, window3, window4]
  })
  BrowserWindow.prototype.webContents = {
    on: vi.fn(),
    send: vi.fn(),
    setWindowOpenHandler: vi.fn(),
  }
  const app = {
    dock: {
      show: vi.fn(),
      hide: vi.fn(),
    }
  }
  const screen = {
    getCursorScreenPoint: vi.fn(() => ({ x: 0, y: 0 })),
  }
  return {
    app,
    screen,
    BrowserWindow,
  }
})

beforeEach(async () => {
  try { await window.closeMainWindow() } catch { /* empty */ }
  try { await window.closeCommandPalette() } catch { /* empty */ }
  try { await window.closePromptAnywhere() } catch { /* empty */ }
  try { await window.closeWaitingPanel() } catch { /* empty */ }
  vi.clearAllMocks()
})

test('All windows are null', async () => {
  expect(window.mainWindow).toBeNull()
  expect(window.commandPalette).toBeNull()
  expect(window.promptAnywhereWindow).toBeNull()
  expect(window.waitingPanel).toBeNull()
})

test('Create main window', async () => {
  await window.openMainWindow()
  expect(window.mainWindow).toBeInstanceOf(BrowserWindow)
  expect(BrowserWindow.prototype.loadURL).toHaveBeenCalledWith('http://localhost:3000/#')
})

test('Two main windows are not created', async () => {
  await window.openMainWindow()
  vi.clearAllMocks()
  await window.openMainWindow()
  expect(BrowserWindow.prototype.isDestroyed).toHaveBeenCalled()
  expect(BrowserWindow.prototype.show).toHaveBeenCalled()
  expect(BrowserWindow.prototype.isMinimized).toHaveBeenCalled()
  expect(BrowserWindow.prototype.focus).toHaveBeenCalled()
  expect(BrowserWindow.prototype.loadURL).not.toHaveBeenCalled()
})

test('Restores existing main window', async () => {
  await window.openMainWindow()
  window.mainWindow.minimize()
  vi.clearAllMocks()
  await window.openMainWindow()
  expect(BrowserWindow.prototype.isDestroyed).toHaveBeenCalled()
  expect(BrowserWindow.prototype.show).toHaveBeenCalled()
  expect(BrowserWindow.prototype.isMinimized).toHaveBeenCalled()
  expect(BrowserWindow.prototype.restore).toHaveBeenCalled()
  expect(BrowserWindow.prototype.focus).toHaveBeenCalled()
  expect(BrowserWindow.prototype.loadURL).not.toHaveBeenCalled()
})

test('Open Settings window in current main window', async () => {
  await window.openMainWindow()
  await window.openSettingsWindow()
  expect(BrowserWindow.prototype.webContents.send).toHaveBeenCalled()
})

test('Open Settings window in new main window', async () => {
  await window.openSettingsWindow()
  expect(window.mainWindow).toBeInstanceOf(BrowserWindow)
  expect(BrowserWindow.prototype.loadURL).toHaveBeenCalledWith('http://localhost:3000/?settings=true#')
})

test('Create chat window', async () => {
  const chatWindow = await window.openChatWindow({ promptId: '1'})
  expect(chatWindow).toBeInstanceOf(BrowserWindow)
  expect(BrowserWindow.prototype.loadURL).toHaveBeenCalledWith('http://localhost:3000/?promptId=1#')
})

test('Create command palette window', async () => {
  await window.openCommandPalette('1')
  expect(window.commandPalette).toBeInstanceOf(BrowserWindow)
  expect(BrowserWindow.prototype.loadURL).toHaveBeenCalledWith('http://localhost:3000/?textId=1#/command')
})

test('Close command palette window', async () => {
  await window.openCommandPalette('1')
  await window.closeCommandPalette()
  expect(window.commandPalette).toBeNull()
})

test('Create prompt anywhere window', async () => {
  await window.openPromptAnywhere()
  expect(window.promptAnywhereWindow).toBeInstanceOf(BrowserWindow)
  expect(BrowserWindow.prototype.loadURL).toHaveBeenCalledWith('http://localhost:3000/#/prompt')
})

test('Resize prompt anywhere window', async () => {
  await window.openPromptAnywhere()
  await window.resizePromptAnywhere(100)
  expect(BrowserWindow.prototype.setSize).toHaveBeenCalledWith(0, 100)
})

test('Close prompt anywhere window', async () => {
  await window.openPromptAnywhere()
  await window.closePromptAnywhere()
  expect(window.promptAnywhereWindow).toBeNull()
})

test('Open waiting panel', async () => {
  await window.openWaitingPanel()
  expect(window.waitingPanel).toBeInstanceOf(BrowserWindow)
  expect(BrowserWindow.prototype.loadURL).toHaveBeenCalledWith('http://localhost:3000/#/wait')
})

test('Close waiting panel', async () => {
  await window.openWaitingPanel()
  await window.closeWaitingPanel()
  expect(window.waitingPanel).toBeNull()
})

// test('Hides active windows', async () => {
//   await window.hideWindows()
//   expect(BrowserWindow.prototype.hide).toHaveBeenCalledTimes(2)
// })

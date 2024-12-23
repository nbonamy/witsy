
import { vi, beforeEach, expect, test, Mock } from 'vitest'
import { BrowserWindow } from 'electron'
import * as window from '../../src/main/window'

global.MAIN_WINDOW_VITE_DEV_SERVER_URL = 'http://localhost:3000/'
global.MAIN_WINDOW_VITE_NAME = 'vite'

vi.mock('electron', async () => {
  const BrowserWindow = vi.fn(function() {
    this.visible = true
    this.minimized = false
    this.destroyed = false
    return this
  })
  BrowserWindow.prototype.show = vi.fn()
  BrowserWindow.prototype.hide = vi.fn(function() { this.visible = false })
  BrowserWindow.prototype.close = vi.fn(function() { this.destroyed = true })
  BrowserWindow.prototype.focus = vi.fn()
  BrowserWindow.prototype.restore = vi.fn(function() { this.minimized = false })
  BrowserWindow.prototype.minimize = vi.fn(function() { this.minimized = true })
  BrowserWindow.prototype.isMinimized = vi.fn(function() { return this.minimized })
  BrowserWindow.prototype.isVisible = vi.fn(function() { return this.visible })
  BrowserWindow.prototype.isDestroyed = vi.fn(function() { return false })
  BrowserWindow.prototype.loadFile = vi.fn()
  BrowserWindow.prototype.loadURL = vi.fn()
  BrowserWindow.prototype.on = vi.fn()
  BrowserWindow.prototype.once = vi.fn()
  BrowserWindow.prototype.setBounds = vi.fn()
  BrowserWindow.prototype.setSize = vi.fn()
  BrowserWindow.prototype.getPosition =  vi.fn(() => [0, 0])
  BrowserWindow.prototype.getSize = vi.fn(() => [0, 0])
  BrowserWindow['getAllWindows'] = vi.fn(() => {
    const window1 = new BrowserWindow()
    const window2 = new BrowserWindow()
    const window3 = new BrowserWindow()
    const window4 = new BrowserWindow()
    window3.visible = false
    window4.minimized = true
    return [window1, window2, window3, window4]
  })
  BrowserWindow.prototype.webContents = {
    on: vi.fn(),
    send: vi.fn(),
    setWindowOpenHandler: vi.fn(),
    openDevTools: vi.fn(),
  }
  const app = {
    dock: {
      show: vi.fn(),
      hide: vi.fn(),
    }
  }
  const screen = {
    getCursorScreenPoint: vi.fn(() => ({ x: 0, y: 0 })),
    getDisplayNearestPoint: vi.fn(() => ({ bounds: { x: 0, y: 0 }, workAreaSize: { width: 0, height: 0 } })),
  }
  const nativeTheme = {
    shouldUseDarkColors: vi.fn(() => false),
  }
  return {
    app,
    screen,
    nativeTheme,
    BrowserWindow,
  }
})

vi.mock('../../src/main/utils', async () => {
  return {
    putCachedText: vi.fn(() => 'textId')
  }
})

const expectCreateWebPreferences = (callParams) => {
  expect(callParams.webPreferences.nodeIntegration).toBe(false)
  expect(callParams.webPreferences.contextIsolation).toBe(true)
  expect(callParams.webPreferences.webSecurity).toBe(false)
  expect(callParams.webPreferences.defaultEncoding).toBe('UTF-8')
  expect(callParams.webPreferences.sandbox).toBe(true)
}

beforeEach(async () => {
  try { await window.closeMainWindow() } catch { /* empty */ }
  try { await window.closeCommandPicker() } catch { /* empty */ }
  try { await window.closePromptAnywhere() } catch { /* empty */ }
  //try { await window.closeWaitingPanel() } catch { /* empty */ }
  vi.clearAllMocks()
})

test('All windows are null', async () => {
  expect(window.mainWindow).toBeNull()
  expect(window.commandPicker).toBeNull()
  expect(window.promptAnywhereWindow).toBeNull()
  //expect(window.waitingPanel).toBeNull()
})

test('Create main window', async () => {
  await window.openMainWindow()
  expect(window.mainWindow).toBeInstanceOf(BrowserWindow)
  expect(BrowserWindow.prototype.constructor).toHaveBeenCalledWith(expect.objectContaining({
    title: 'Witsy'
  }))
  expect(BrowserWindow.prototype.loadURL).toHaveBeenCalledWith('http://localhost:3000/#')

})

test('Main window properties', async () => {
  await window.openMainWindow()
  const callParams = (BrowserWindow as unknown as Mock).mock.calls[0][0]
  expect(callParams.width).toBeDefined()
  expect(callParams.height).toBeDefined()
  expect(callParams.titleBarOverlay).toBeDefined()
  expect(callParams.trafficLightPosition).toBeDefined()
  expect(callParams.show).toBe(false)
  expectCreateWebPreferences(callParams)
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
  expect(BrowserWindow.prototype.webContents.send).toHaveBeenCalledWith('query-params', { settings: true })
})

test('Open Settings window in new main window', async () => {
  await window.openSettingsWindow()
  expect(BrowserWindow.prototype.constructor).toHaveBeenCalledWith(expect.objectContaining({
    title: 'Witsy',
    queryParams: { settings: true }
  }))
  expect(window.mainWindow).toBeInstanceOf(BrowserWindow)
  expect(BrowserWindow.prototype.loadURL).toHaveBeenCalledWith('http://localhost:3000/?settings=true#')
})

test('Create chat window', async () => {
  const chatWindow = await window.openChatWindow({ promptId: 'id'})
  expect(chatWindow).toBeInstanceOf(BrowserWindow)
  expect(BrowserWindow.prototype.loadURL).toHaveBeenCalledWith('http://localhost:3000/?promptId=id#')
  const callParams = (BrowserWindow as unknown as Mock).mock.calls[0][0]
  expectCreateWebPreferences(callParams)
})

test('Create command picker window', async () => {
  await window.openCommandPicker({ textId: 'id' })
  expect(window.commandPicker).toBeInstanceOf(BrowserWindow)
  expect(BrowserWindow.prototype.loadURL).toHaveBeenCalledWith('http://localhost:3000/?textId=id#/commands')
  const callParams = (BrowserWindow as unknown as Mock).mock.calls[0][0]
  expectCreateWebPreferences(callParams)
})

test('Close command picker window', async () => {
  await window.openCommandPicker({ textId: 'id' })
  await window.closeCommandPicker()
  expect(window.commandPicker).toBeNull()
})

test('Open command result window', async () => {
  await window.openCommandResult({ textId: 'id' })
  expect(BrowserWindow.prototype.constructor).toHaveBeenCalledWith(expect.objectContaining({
    hash: '/command',
    queryParams: { textId: 'id' }
  }))
  expect(BrowserWindow.prototype.loadURL).toHaveBeenCalledWith('http://localhost:3000/?textId=id#/command')
  const callParams = (BrowserWindow as unknown as Mock).mock.calls[0][0]
  expectCreateWebPreferences(callParams)
})

test('Create prompt anywhere window', async () => {
  await window.openPromptAnywhere({ promptId: 'id' })
  expect(window.promptAnywhereWindow).toBeInstanceOf(BrowserWindow)
  expect(BrowserWindow.prototype.constructor).toHaveBeenCalledWith(expect.objectContaining({
    hash: '/prompt',
    queryParams: { promptId: 'id' }
  }))
  expect(BrowserWindow.prototype.loadURL).toHaveBeenCalledWith('http://localhost:3000/?promptId=id#/prompt')
  const callParams = (BrowserWindow as unknown as Mock).mock.calls[0][0]
  expectCreateWebPreferences(callParams)
  expect(BrowserWindow.prototype.webContents.send).not.toHaveBeenCalled()
})

test('Update prompt anywhere window', async () => {
  await window.preparePromptAnywhere({ promptId: 'id' })
  expect(window.promptAnywhereWindow).toBeInstanceOf(BrowserWindow)
  expect(BrowserWindow.prototype.constructor).toHaveBeenCalledWith(expect.objectContaining({
    hash: '/prompt',
    queryParams: { promptId: 'id' }
  }))
  expect(BrowserWindow.prototype.loadURL).toHaveBeenCalledWith('http://localhost:3000/?promptId=id#/prompt')
  const callParams = (BrowserWindow as unknown as Mock).mock.calls[0][0]
  expectCreateWebPreferences(callParams)
  await window.openPromptAnywhere({ promptId: 'id' })
  expect(BrowserWindow.prototype.webContents.send).toHaveBeenCalledWith('show', { promptId: 'id'})
})

test('Close prompt anywhere window', async () => {
  await window.openPromptAnywhere({})
  await window.closePromptAnywhere()
  expect(window.promptAnywhereWindow).not.toBeNull()
})

test('Open Readaloud window', async () => {
  await window.openReadAloudPalette('textId')
  expect(BrowserWindow.prototype.constructor).toHaveBeenCalledWith(expect.objectContaining({
    hash: '/readaloud',
    queryParams: { textId: 'textId' }
  }))
  expect(BrowserWindow.prototype.loadURL).toHaveBeenCalledWith('http://localhost:3000/?textId=textId#/readaloud')
  const callParams = (BrowserWindow as unknown as Mock).mock.calls[0][0]
  expectCreateWebPreferences(callParams)
})

test('Open Transcribe window', async () => {
  await window.openTranscribePalette()
  expect(window.transcribePalette).toBeInstanceOf(BrowserWindow)
  expect(BrowserWindow.prototype.constructor).toHaveBeenCalledWith(expect.objectContaining({
    hash: '/transcribe',
    title: 'Dictation',
  }))
  expect(BrowserWindow.prototype.loadURL).toHaveBeenCalledWith('http://localhost:3000/#/transcribe')
  const callParams = (BrowserWindow as unknown as Mock).mock.calls[0][0]
  expectCreateWebPreferences(callParams)
})

test('Open Scratchpad window', async () => {
  await window.openScratchPad('text')
  expect(BrowserWindow.prototype.constructor).toHaveBeenCalledWith(expect.objectContaining({
    hash: '/scratchpad',
    title: 'Scratchpad',
    queryParams: { textId: 'textId' }
  }))
  expect(BrowserWindow.prototype.loadURL).toHaveBeenCalledWith('http://localhost:3000/?textId=textId#/scratchpad')
  const callParams = (BrowserWindow as unknown as Mock).mock.calls[0][0]
  expectCreateWebPreferences(callParams)
});

test('Open Realtime window', async () => {
  await window.openRealtimeChatWindow()
  expect(BrowserWindow.prototype.constructor).toHaveBeenCalledWith(expect.objectContaining({
    hash: '/realtime',
    title: 'Realtime Chat'
  }))
  expect(BrowserWindow.prototype.loadURL).toHaveBeenCalledWith('http://localhost:3000/#/realtime')
  const callParams = (BrowserWindow as unknown as Mock).mock.calls[0][0]
  expectCreateWebPreferences(callParams)
})

test('Hides and restores active windows', async () => {
  await window.restoreWindows()
  expect(BrowserWindow.prototype.restore).toHaveBeenCalledTimes(0)
  await window.hideWindows()
  expect(BrowserWindow.prototype.hide).toHaveBeenCalledTimes(2)
  await window.restoreWindows()
  expect(BrowserWindow.prototype.restore).toHaveBeenCalledTimes(2)
  await window.restoreWindows()
  expect(BrowserWindow.prototype.restore).toHaveBeenCalledTimes(2)
})

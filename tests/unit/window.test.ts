
import { vi, beforeAll, beforeEach, expect, test, Mock } from 'vitest'
import { BrowserWindow, dialog, Menu, shell, } from 'electron'
import { useWindowMock } from '../mocks/window'
import { store } from '../../src/services/store'
import * as window from '../../src/main/window'
import { Application } from '../../src/types/automation'

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
  BrowserWindow.prototype.off = vi.fn()
  BrowserWindow.prototype.once = vi.fn()
  BrowserWindow.prototype.removeAllListeners = vi.fn()
  BrowserWindow.prototype.getPosition =  vi.fn(() => [0, 0])
  BrowserWindow.prototype.getSize = vi.fn(() => [0, 0])
  BrowserWindow.prototype.setPosition = vi.fn()
  BrowserWindow.prototype.getBounds = vi.fn(() => ({ x: 100, y: 200, width: 150, height: 250}))
  BrowserWindow.prototype.setBounds = vi.fn()
  BrowserWindow.prototype.setSize = vi.fn()
  BrowserWindow.prototype.setOpacity = vi.fn()
  BrowserWindow.prototype.setIgnoreMouseEvents = vi.fn()
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
    capturePage: vi.fn(() => ({
      getBitmap: vi.fn(() => ([0, 0, 0, 0]))
    })),
    openDevTools: vi.fn(),
    debugger: {
      attach: vi.fn(),
      sendCommand: vi.fn(),
      on: vi.fn(),
    }
  }
  const app = {
    focus: vi.fn(),
    getPath: vi.fn(() => ''),
    getLocale: vi.fn(() => 'en'),
    dock: {
      show: vi.fn(),
      hide: vi.fn(),
    }
  }
  const screen = {
    getCursorScreenPoint: vi.fn(() => ({ x: 0, y: 0 })),
    getDisplayNearestPoint: vi.fn(() => ({
      bounds: { x: 0, y: 0, width: 1024, height: 768 },
      workArea: { x: 0, y: 25 },
      workAreaSize: { width: 0, height: 0 }
    })),
  }
  const nativeTheme = {
    shouldUseDarkColors: vi.fn(() => false),
  }
  const dialog = {
    showMessageBoxSync: vi.fn(() => 1),
  }
  const shell = {
    openExternal: vi.fn(),
  }
  const Menu = {
    sendActionToFirstResponder: vi.fn(),
  }
  return {
    app,
    shell,
    screen,
    dialog,
    nativeTheme,
    BrowserWindow,
    Menu
  }
})

vi.mock('../../src/automations/automator.ts', async () => {
  const Automator = vi.fn()
  Automator.prototype.getForemostApp = vi.fn(() => ({ id: 'appId', name: 'appName', path: 'appPath', window: 'title' }))
  return { default: Automator }
})

vi.mock('../../src/main/utils', async () => {
  return {
    wait: vi.fn(),
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

beforeAll(() => {
  useWindowMock()
})

beforeEach(async () => {
  store.loadSettings()
  try { window.closeMainWindow() } catch { /* empty */ }
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
  window.openMainWindow()
  expect(window.mainWindow).toBeInstanceOf(BrowserWindow)
  expect(BrowserWindow.prototype.constructor).toHaveBeenLastCalledWith(expect.objectContaining({
    title: 'Witsy'
  }))
  expect(BrowserWindow.prototype.loadURL).toHaveBeenLastCalledWith('http://localhost:3000/?view=chat#')
  expect(window.mainWindow.isVisible()).toBe(true)
  window.closeMainWindow()
  expect(window.mainWindow).toBeNull()

})

test('Main window properties', async () => {
  window.openMainWindow()
  const callParams = (BrowserWindow as unknown as Mock).mock.calls[0][0]
  expect(callParams.width).toBeDefined()
  expect(callParams.height).toBeDefined()
  expect(callParams.titleBarOverlay).toBeDefined()
  expect(callParams.trafficLightPosition).toBeDefined()
  expect(callParams.show).toBe(false)
  expectCreateWebPreferences(callParams)
})

test('Two main windows are not created', async () => {
  window.openMainWindow()
  vi.clearAllMocks()
  window.openMainWindow()
  expect(BrowserWindow.prototype.isDestroyed).toHaveBeenCalled()
  expect(BrowserWindow.prototype.show).toHaveBeenCalled()
  expect(BrowserWindow.prototype.isMinimized).toHaveBeenCalled()
  expect(BrowserWindow.prototype.focus).toHaveBeenCalled()
  expect(BrowserWindow.prototype.loadURL).not.toHaveBeenCalled()
})

test('Restores existing main window', async () => {
  window.openMainWindow()
  window.mainWindow.minimize()
  vi.clearAllMocks()
  window.openMainWindow()
  expect(BrowserWindow.prototype.isDestroyed).toHaveBeenCalled()
  expect(BrowserWindow.prototype.show).toHaveBeenCalled()
  expect(BrowserWindow.prototype.isMinimized).toHaveBeenCalled()
  expect(BrowserWindow.prototype.restore).toHaveBeenCalled()
  expect(BrowserWindow.prototype.focus).toHaveBeenCalled()
  expect(BrowserWindow.prototype.loadURL).not.toHaveBeenCalled()
})

test('Open Settings window', async () => {
  window.openSettingsWindow()
  expect(BrowserWindow.prototype.constructor).toHaveBeenLastCalledWith(expect.objectContaining({
    queryParams: { view: 'settings', }
  }))
  const callParams = (BrowserWindow as unknown as Mock).mock.calls[0][0]
  expectCreateWebPreferences(callParams)
})

test('Switch to Settings window', async () => {
  window.openMainWindow()
  window.openSettingsWindow()
  expect(BrowserWindow.prototype.webContents.send).toHaveBeenLastCalledWith('query-params', { view: 'settings' })
})

test('Create command picker window', async () => {
  window.openCommandPicker({ textId: 'id' })
  expect(window.commandPicker).toBeInstanceOf(BrowserWindow)
  expect(BrowserWindow.prototype.loadURL).toHaveBeenLastCalledWith('http://localhost:3000/?textId=id#/commands')
  const callParams = (BrowserWindow as unknown as Mock).mock.calls[0][0]
  expectCreateWebPreferences(callParams)
})

test('Close command picker window', async () => {
  window.openCommandPicker({ textId: 'id' })
  await window.closeCommandPicker({} as Application)
  expect(window.commandPicker).not.toBeNull()
  expect(window.commandPicker.isVisible()).toBe(false)
  expect(Menu.sendActionToFirstResponder).toHaveBeenCalled()
})

test('Create prompt anywhere window', async () => {
  window.openPromptAnywhere({ promptId: 'id' })
  expect(window.promptAnywhereWindow).toBeInstanceOf(BrowserWindow)
  expect(BrowserWindow.prototype.constructor).toHaveBeenLastCalledWith(expect.objectContaining({
    hash: '/prompt',
    queryParams: { promptId: 'id' }
  }))
  expect(BrowserWindow.prototype.loadURL).toHaveBeenLastCalledWith('http://localhost:3000/?promptId=id#/prompt')
  const callParams = (BrowserWindow as unknown as Mock).mock.calls[0][0]
  expectCreateWebPreferences(callParams)
  expect(BrowserWindow.prototype.webContents.send).not.toHaveBeenCalled()
})

test('Update prompt anywhere window', async () => {
  window.preparePromptAnywhere({ promptId: 'id' })
  expect(window.promptAnywhereWindow).toBeInstanceOf(BrowserWindow)
  expect(BrowserWindow.prototype.constructor).toHaveBeenLastCalledWith(expect.objectContaining({
    hash: '/prompt',
    queryParams: { promptId: 'id' }
  }))
  expect(BrowserWindow.prototype.loadURL).toHaveBeenLastCalledWith('http://localhost:3000/?promptId=id#/prompt')
  const callParams = (BrowserWindow as unknown as Mock).mock.calls[0][0]
  expectCreateWebPreferences(callParams)
  window.openPromptAnywhere({ promptId: 'id' })
  expect(BrowserWindow.prototype.webContents.send).toHaveBeenLastCalledWith('show', { promptId: 'id'})
})

test('Resize prompt anywhere window', async () => {
  window.openPromptAnywhere({ promptId: 'id' })
  window.resizePromptAnywhere(10, 20)
  expect(BrowserWindow.prototype.setBounds).toHaveBeenCalledWith({ x: 100, y: 200, width: 160, height: 270 })
})

test('Close prompt anywhere window', async () => {
  window.openPromptAnywhere({})
  await window.closePromptAnywhere()
  expect(window.promptAnywhereWindow).not.toBeNull()
})

test('Open Readaloud window', async () => {
  window.openReadAloudPalette({ textId: 'textId', sourceApp: JSON.stringify({ id: 'appId', name: 'appName', path: 'appPath', window: 'title' }) })
  expect(BrowserWindow.prototype.constructor).toHaveBeenLastCalledWith(expect.objectContaining({
    hash: '/readaloud',
    queryParams: {
      textId: 'textId',
      sourceApp: "{\"id\":\"appId\",\"name\":\"appName\",\"path\":\"appPath\",\"window\":\"title\"}"
    }
  }))
  expect(BrowserWindow.prototype.loadURL).toHaveBeenLastCalledWith('http://localhost:3000/?textId=textId&sourceApp=%7B%22id%22%3A%22appId%22%2C%22name%22%3A%22appName%22%2C%22path%22%3A%22appPath%22%2C%22window%22%3A%22title%22%7D#/readaloud')
  const callParams = (BrowserWindow as unknown as Mock).mock.calls[0][0]
  expectCreateWebPreferences(callParams)
})

test('Open Transcribe window', async () => {
  window.openTranscribePalette()
  expect(window.transcribePalette).toBeInstanceOf(BrowserWindow)
  expect(BrowserWindow.prototype.constructor).toHaveBeenLastCalledWith(expect.objectContaining({
    hash: '/transcribe',
    title: 'Speech-to-Text',
  }))
  expect(BrowserWindow.prototype.loadURL).toHaveBeenLastCalledWith('http://localhost:3000/#/transcribe')
  const callParams = (BrowserWindow as unknown as Mock).mock.calls[0][0]
  expectCreateWebPreferences(callParams)
})

test('Open Scratchpad window', async () => {
  window.openScratchPad('text')
  expect(BrowserWindow.prototype.constructor).toHaveBeenLastCalledWith(expect.objectContaining({
    hash: '/scratchpad',
    title: 'Scratchpad',
    queryParams: { textId: 'textId' }
  }))
  expect(BrowserWindow.prototype.loadURL).toHaveBeenLastCalledWith('http://localhost:3000/?textId=textId#/scratchpad')
  const callParams = (BrowserWindow as unknown as Mock).mock.calls[0][0]
  expectCreateWebPreferences(callParams)
});

test('Open Realtime window', async () => {
  window.openRealtimeChatWindow()
  expect(BrowserWindow.prototype.constructor).toHaveBeenLastCalledWith(expect.objectContaining({
    hash: '/realtime',
    title: 'Voice Chat'
  }))
  expect(BrowserWindow.prototype.loadURL).toHaveBeenLastCalledWith('http://localhost:3000/#/realtime')
  const callParams = (BrowserWindow as unknown as Mock).mock.calls[0][0]
  expectCreateWebPreferences(callParams)
})

test('Open Design Studio window', async () => {
  window.openDesignStudioWindow()
  expect(BrowserWindow.prototype.constructor).toHaveBeenLastCalledWith(expect.objectContaining({
    queryParams: { view: 'studio', }
  }))
  const callParams = (BrowserWindow as unknown as Mock).mock.calls[0][0]
  expectCreateWebPreferences(callParams)
})

test('Switch to Design Studio window', async () => {
  window.openMainWindow()
  window.openDesignStudioWindow()
  expect(BrowserWindow.prototype.webContents.send).toHaveBeenLastCalledWith('query-params', { view: 'studio' })
})

test('Open Computer', async () => {
  window.openComputerStatusWindow()
  expect(BrowserWindow.prototype.constructor).toHaveBeenLastCalledWith(expect.objectContaining({
    hash: '/computer',
  }))
  expect(BrowserWindow.prototype.loadURL).toHaveBeenLastCalledWith('http://localhost:3000/#/computer')
  const callParams = (BrowserWindow as unknown as Mock).mock.calls[0][0]
  expectCreateWebPreferences(callParams)
})

test('Open Debug window', async () => {
  window.openDebugWindow()
  expect(BrowserWindow.prototype.constructor).toHaveBeenLastCalledWith(expect.objectContaining({
    hash: '/debug',
  }))
  expect(BrowserWindow.prototype.loadURL).toHaveBeenLastCalledWith('http://localhost:3000/#/debug')
  const callParams = (BrowserWindow as unknown as Mock).mock.calls[0][0]
  expectCreateWebPreferences(callParams)
})

test('MAS build warning', async () => {
  window.showMasLimitsDialog()
  expect(dialog.showMessageBoxSync).toHaveBeenLastCalledWith(null, {
    buttons: ['Close', 'Check website'],
    message: expect.any(String),
    detail: expect.any(String),
    defaultId: 1,
  })
  expect(shell.openExternal).toHaveBeenLastCalledWith(expect.stringContaining('https://witsyai.com/'))
})

test('Utilities', async () => {
  expect(window.persistentWindows().length).toBe(3)
  expect(window.areAllWindowsClosed()).toBe(false)
})

test('Notify', async () => {
  window.notifyBrowserWindows('event')
  expect(BrowserWindow.prototype.webContents.send).toHaveBeenCalledWith('event')
})


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
    getDisplayNearestPoint: vi.fn(() => ({ bounds: { x: 0, y: 0 }, workAreaSize: { width: 0, height: 0 } })),
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
  expect(BrowserWindow.prototype.constructor).toHaveBeenLastCalledWith(expect.objectContaining({
    title: 'Chat'
  }))
  expect(BrowserWindow.prototype.loadURL).toHaveBeenLastCalledWith('http://localhost:3000/#')

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

test('Open Settings window', async () => {
  await window.openSettingsWindow()
  expect(window.settingsWindow).toBeInstanceOf(BrowserWindow)
  expect(BrowserWindow.prototype.constructor).toHaveBeenLastCalledWith(expect.objectContaining({
    hash: '/settings',
  }))
  expect(BrowserWindow.prototype.loadURL).toHaveBeenLastCalledWith('http://localhost:3000/#/settings')
})

test('Create command picker window', async () => {
  await window.openCommandPicker({ textId: 'id' })
  expect(window.commandPicker).toBeInstanceOf(BrowserWindow)
  expect(BrowserWindow.prototype.loadURL).toHaveBeenLastCalledWith('http://localhost:3000/?textId=id#/commands')
  const callParams = (BrowserWindow as unknown as Mock).mock.calls[0][0]
  expectCreateWebPreferences(callParams)
})

test('Close command picker window', async () => {
  await window.openCommandPicker({ textId: 'id' })
  await window.closeCommandPicker({} as Application)
  expect(window.commandPicker).not.toBeNull()
  expect(window.commandPicker.isVisible()).toBe(false)
  expect(Menu.sendActionToFirstResponder).toHaveBeenCalled()
})

test('Create prompt anywhere window', async () => {
  await window.openPromptAnywhere({ promptId: 'id' })
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
  await window.preparePromptAnywhere({ promptId: 'id' })
  expect(window.promptAnywhereWindow).toBeInstanceOf(BrowserWindow)
  expect(BrowserWindow.prototype.constructor).toHaveBeenLastCalledWith(expect.objectContaining({
    hash: '/prompt',
    queryParams: { promptId: 'id' }
  }))
  expect(BrowserWindow.prototype.loadURL).toHaveBeenLastCalledWith('http://localhost:3000/?promptId=id#/prompt')
  const callParams = (BrowserWindow as unknown as Mock).mock.calls[0][0]
  expectCreateWebPreferences(callParams)
  await window.openPromptAnywhere({ promptId: 'id' })
  expect(BrowserWindow.prototype.webContents.send).toHaveBeenLastCalledWith('show', { promptId: 'id'})
})

test('Close prompt anywhere window', async () => {
  window.openPromptAnywhere({})
  await window.closePromptAnywhere()
  expect(window.promptAnywhereWindow).not.toBeNull()
  expect(window.promptAnywhereWindow.isVisible()).toBe(false)
  expect(Menu.sendActionToFirstResponder).toHaveBeenCalled()
})

test('Open Readaloud window', async () => {
  await window.openReadAloudPalette({ textId: 'textId', sourceApp: JSON.stringify({ id: 'appId', name: 'appName', path: 'appPath', window: 'title' }) })
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
  await window.openTranscribePalette()
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
  await window.openScratchPad('text')
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
  await window.openRealtimeChatWindow()
  expect(BrowserWindow.prototype.constructor).toHaveBeenLastCalledWith(expect.objectContaining({
    hash: '/realtime',
    title: 'Voice Chat'
  }))
  expect(BrowserWindow.prototype.loadURL).toHaveBeenLastCalledWith('http://localhost:3000/#/realtime')
  const callParams = (BrowserWindow as unknown as Mock).mock.calls[0][0]
  expectCreateWebPreferences(callParams)
})

test('Open Create Media window', async () => {
  await window.openDesignStudioWindow()
  expect(BrowserWindow.prototype.constructor).toHaveBeenLastCalledWith(expect.objectContaining({
    hash: '/studio',
    title: 'Design Studio',
  }))
  expect(BrowserWindow.prototype.loadURL).toHaveBeenLastCalledWith('http://localhost:3000/#/studio')
  const callParams = (BrowserWindow as unknown as Mock).mock.calls[0][0]
  expectCreateWebPreferences(callParams)
})

test('Open Computer', async () => {
  await window.openComputerStatusWindow()
  expect(BrowserWindow.prototype.constructor).toHaveBeenLastCalledWith(expect.objectContaining({
    hash: '/computer',
  }))
  expect(BrowserWindow.prototype.loadURL).toHaveBeenLastCalledWith('http://localhost:3000/#/computer')
  const callParams = (BrowserWindow as unknown as Mock).mock.calls[0][0]
  expectCreateWebPreferences(callParams)
})

test('Open Debug window', async () => {
  await window.openDebugWindow()
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
  expect(window.persistentWindows().length).toBe(2)
  expect(window.areAllWindowsClosed()).toBe(false)
})

test('Notify', async () => {
  window.notifyBrowserWindows('event')
  expect(BrowserWindow.prototype.webContents.send).toHaveBeenCalledWith('event')
})

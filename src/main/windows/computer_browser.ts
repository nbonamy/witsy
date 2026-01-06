import { BrowserWindow } from 'electron'
import { ComputerAction } from '../../types/index'
import { getCleanUserAgent } from '../utils'

class ComputerBrowserWindow {

  private window: BrowserWindow | null = null
  private ttlTimer: NodeJS.Timeout | null = null
  private readonly TTL_MS = 5 * 60 * 1000 // 5 minutes
  private readonly WINDOW_WIDTH = 1440
  private readonly WINDOW_HEIGHT = 900

  isAvailable(): boolean {
    return true
  }

  hide(): void {
    if (this.isReady()) {
      this.window.hide()
    }
  }

  private createWindow(): BrowserWindow {
    const win = new BrowserWindow({
      width: this.WINDOW_WIDTH,
      height: this.WINDOW_HEIGHT,
      show: false, // Start hidden, show when needed
      frame: true,
      focusable: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        partition: 'persist:computer-browser',
        webSecurity: false, // Allow mixed content and ignore cert errors
      },
    })

    // Set clean user agent
    const originalUA = win.webContents.session.getUserAgent()
    const cleanUA = getCleanUserAgent(originalUA)
    win.webContents.session.setUserAgent(cleanUA)

    // Ignore certificate errors
    win.webContents.session.setCertificateVerifyProc((request, callback) => {
      callback(0) // 0 = trust, -2 = reject, -3 = use default verification
    })

    // Prevent memory leaks
    win.webContents.setMaxListeners(20)

    // Handle window close
    win.on('closed', () => {
      this.window = null
      this.clearTTL()
    })

    return win
  }

  private isReady(): boolean {
    return this.window !== null
  }

  private getOrCreateWindow(): BrowserWindow {
    if (!this.isReady()) {
      this.window = this.createWindow()
    }
    return this.window
  }

  private resetTTL(): void {
    this.clearTTL()
    this.ttlTimer = setTimeout(() => {
      console.log('[computer-browser] TTL expired, closing window')
      this.close()
    }, this.TTL_MS)
  }

  private clearTTL(): void {
    if (this.ttlTimer) {
      clearTimeout(this.ttlTimer)
      this.ttlTimer = null
    }
  }

  async getCurrentURL(): Promise<string> {
    return !this.isReady() ? '' : (this.window?.webContents?.getURL() || 'about:blank')
  }

  async takeScreenshot(): Promise<string> {
    if (!this.isReady()) {
      return null
    }

    try {
      const image = await this.window.webContents.capturePage()
      const { width, height } = image.getSize()
      const targetWidth = 1000
      const scaleFactor = targetWidth / width
      const targetHeight = Math.round(height * scaleFactor)
      const resized = image.resize({ width: targetWidth, height: targetHeight })
      return resized.toJPEG(80).toString('base64')
    } catch (e) {
      console.error('[computer-browser] Error taking screenshot:', e)
      return null
    }
  }

  normalizedToViewport(x: number, y: number): { x: number, y: number } {
    return {
      x: Math.round((x * this.WINDOW_WIDTH) / 1000),
      y: Math.round((y * this.WINDOW_HEIGHT) / 1000),
    }
  }

  async executeAction(action: ComputerAction): Promise<{ url: string, screenshot: string }> {

    const win = this.getOrCreateWindow()
    this.resetTTL()

    // Show window when executing actions
    win.show()

    try {
      await this.executeActionInternal(win, action)
    } catch (err) {
      console.error('[computer-browser] Error executing action:', err)
    }

    // Always return URL and screenshot
    const url = await this.getCurrentURL()
    const screenshot = await this.takeScreenshot()

    return { url, screenshot }
  }

  private async executeActionInternal(win: BrowserWindow, action: ComputerAction): Promise<void> {

    switch (action.action) {

      case 'open_web_browser':
      case 'navigate':
        if (action.url) {
          await this.navigate(win, action.url)
        }
        break

      case 'go_back':
        win.webContents.goBack()
        await this.waitForLoad(win)
        break

      case 'go_forward':
        win.webContents.goForward()
        await this.waitForLoad(win)
        break

      case 'search':
        if (action.query) {
          const searchURL = `https://www.google.com/search?q=${encodeURIComponent(action.query)}`
          await this.navigate(win, searchURL)
        }
        break

      case 'click_at':
        if (action.coordinate) {
          await this.click(win, action.coordinate[0], action.coordinate[1])
        }
        break

      case 'hover_at':
        if (action.coordinate) {
          await this.hover(win, action.coordinate[0], action.coordinate[1])
        }
        break

      case 'type_text_at':
        if (action.coordinate && action.text) {
          await this.click(win, action.coordinate[0], action.coordinate[1])
          await this.type(win, action.text)
        }
        break

      case 'scroll_document':
        await this.scrollDocument(win, action.direction, action.amount || 3)
        break

      case 'scroll_at':
        if (action.coordinate) {
          await this.scrollAt(win, action.coordinate[0], action.coordinate[1], action.direction, action.amount || 3)
        }
        break

      case 'key_combination':
        if (action.keys) {
          await this.keyCombo(win, action.keys)
        }
        break

      case 'drag_and_drop':
        if (action.coordinates) {
          await this.dragAndDrop(
            win,
            action.coordinates.from[0], action.coordinates.from[1],
            action.coordinates.to[0], action.coordinates.to[1]
          )
        }
        break

      case 'wait_5_seconds':
        await new Promise(resolve => setTimeout(resolve, 5000))
        break

      default:
        console.warn(`[computer-browser] Unknown action: ${action.action}`)
    }
  }

  private async navigate(win: BrowserWindow, url: string): Promise<void> {
    const startTime = Date.now()
    console.log(`[computer-browser] Navigating to ${url}`)

    try {
      // Wrap entire navigation in timeout to prevent long hangs
      await Promise.race([
        (async () => {
          await win.loadURL(url)
          await this.waitForLoad(win)
        })(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Navigation timeout')), 5000))
      ])
      console.log(`[computer-browser] Navigation completed in ${Date.now() - startTime}ms`)
    } catch (err) {
      console.warn(`[computer-browser] Navigation timeout/error after ${Date.now() - startTime}ms:`, err.message)
      // Don't throw - just log and continue
    }
  }

  private waitForLoad(win: BrowserWindow): Promise<void> {
    return new Promise((resolve) => {
      let resolved = false
      const startTime = Date.now()

      const cleanup = (reason: string) => {
        if (resolved) return
        resolved = true
        clearTimeout(timeout)
        console.log(`[computer-browser] Load completed: ${reason} (${Date.now() - startTime}ms)`)
        resolve()
      }

      const timeout = setTimeout(() => {
        cleanup('timeout')
      }, 5000) // 5 second timeout

      if (win.webContents.isLoading()) {
        win.webContents.once('did-finish-load', () => cleanup('did-finish-load'))
        win.webContents.once('did-fail-load', () => cleanup('did-fail-load'))
        win.webContents.once('did-fail-provisional-load', () => cleanup('did-fail-provisional-load'))
      } else {
        cleanup('already-loaded')
      }
    })
  }

  private async click(win: BrowserWindow, x: number, y: number): Promise<void> {
    const pos = this.normalizedToViewport(x, y)
    win.webContents.sendInputEvent({ type: 'mouseDown', x: pos.x, y: pos.y, button: 'left', clickCount: 1 })
    win.webContents.sendInputEvent({ type: 'mouseUp', x: pos.x, y: pos.y, button: 'left', clickCount: 1 })
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  private async hover(win: BrowserWindow, x: number, y: number): Promise<void> {
    const pos = this.normalizedToViewport(x, y)
    win.webContents.sendInputEvent({ type: 'mouseMove', x: pos.x, y: pos.y })
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  private async type(win: BrowserWindow, text: string): Promise<void> {
    for (const char of text) {
      win.webContents.sendInputEvent({ type: 'char', keyCode: char })
      await new Promise(resolve => setTimeout(resolve, 50))
    }
  }

  private async scrollDocument(win: BrowserWindow, direction: string, amount: number): Promise<void> {
    const scrollAmount = amount * 100
    const scrollCode = direction === 'down' ? `window.scrollBy(0, ${scrollAmount})` :
                       direction === 'up' ? `window.scrollBy(0, -${scrollAmount})` :
                       direction === 'right' ? `window.scrollBy(${scrollAmount}, 0)` :
                       direction === 'left' ? `window.scrollBy(-${scrollAmount}, 0)` : ''

    if (scrollCode) {
      await win.webContents.executeJavaScript(scrollCode)
      await new Promise(resolve => setTimeout(resolve, 200))
    }
  }

  private async scrollAt(win: BrowserWindow, x: number, y: number, direction: string, amount: number): Promise<void> {
    // Focus element at position first
    await this.click(win, x, y)
    await this.scrollDocument(win, direction, amount)
  }

  private async keyCombo(win: BrowserWindow, keys: string[]): Promise<void> {
    // Map common keys
    const keyMap: Record<string, string> = {
      'ctrl': 'control',
      'cmd': 'meta',
      'command': 'meta',
    }

    const modifiers = []
    let key = ''

    for (const k of keys) {
      const normalized = k.toLowerCase()
      if (['control', 'shift', 'alt', 'meta'].includes(keyMap[normalized] || normalized)) {
        modifiers.push(keyMap[normalized] || normalized)
      } else {
        key = k
      }
    }

    win.webContents.sendInputEvent({
      type: 'keyDown',
      keyCode: key,
      modifiers: modifiers as any
    })
    win.webContents.sendInputEvent({
      type: 'keyUp',
      keyCode: key,
      modifiers: modifiers as any
    })
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  private async dragAndDrop(win: BrowserWindow, fromX: number, fromY: number, toX: number, toY: number): Promise<void> {
    const from = this.normalizedToViewport(fromX, fromY)
    const to = this.normalizedToViewport(toX, toY)

    win.webContents.sendInputEvent({ type: 'mouseDown', x: from.x, y: from.y, button: 'left', clickCount: 1 })
    await new Promise(resolve => setTimeout(resolve, 100))
    win.webContents.sendInputEvent({ type: 'mouseMove', x: to.x, y: to.y })
    await new Promise(resolve => setTimeout(resolve, 100))
    win.webContents.sendInputEvent({ type: 'mouseUp', x: to.x, y: to.y, button: 'left', clickCount: 1 })
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  close(): void {
    this.clearTTL()
    if (this.isAvailable()) {
      try {
        this.window.close()
      } catch (e) {
        console.error('[computer-browser] Error closing window:', e)
      }
      this.window = null
    }
  }

}

// Singleton instance
const computerBrowser = new ComputerBrowserWindow()
export default computerBrowser

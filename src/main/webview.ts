import { session, shell, webContents } from 'electron'

/**
 * Initialize the webview session with custom user agent
 * Removes "Witsy" and "Electron" from the user agent to avoid detection
 */
export function initWebviewSession(): void {
  const wvSession = session.fromPartition('persist:webview')
  const originUA = wvSession.getUserAgent()
  const newUA = originUA
    .replace(/Witsy\/\S+\s/, '')
    .replace(/Electron\/\S+\s/, '')

  wvSession.setUserAgent(newUA)
  wvSession.webRequest.onBeforeSendHeaders((details, cb) => {
    const headers = {
      ...details.requestHeaders,
      'User-Agent': newUA
    }
    cb({ requestHeaders: headers })
  })
}

/**
 * Configure whether links opened from webview should open externally or within the app
 * @param webviewId The webContents ID of the webview
 * @param isExternal Whether to open links in external browser
 */
export function setWebviewLinkBehavior(webviewId: number, isExternal: boolean): void {
  const webview = webContents.fromId(webviewId)
  if (!webview) return

  webview.setWindowOpenHandler(({ url }) => {
    if (isExternal) {
      shell.openExternal(url)
      return { action: 'deny' }
    } else {
      return { action: 'allow' }
    }
  })
}

/**
 * Enable or disable spell check for a specific webview
 * @param webviewId The webContents ID of the webview
 * @param enabled Whether spell check should be enabled
 */
export function setWebviewSpellCheck(webviewId: number, enabled: boolean): void {
  const webview = webContents.fromId(webviewId)
  if (!webview) return

  webview.session.setSpellCheckerEnabled(enabled)
}

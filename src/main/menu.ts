import { ShortcutsConfig } from 'types/config'
import { App, BrowserWindow, Menu, shell } from 'electron'
import { shortcutAccelerator } from './shortcuts'
import * as window from './window'
import { useI18n } from './i18n';

export type MenuCallbacks = {
  checkForUpdates: () => void
  settings: () => void
  quit: () => void
  quickPrompt: () => void
  newChat: () => void
  scratchpad: () => void
  studio: () => void
}

const isMac = process.platform === 'darwin'
const isMas = process.mas

const template = (app: App, callbacks: MenuCallbacks, shortcuts: ShortcutsConfig) => {

  // i18n
  const t = useI18n(app)

  // get focused window
  const focusedWindow = BrowserWindow.getFocusedWindow()

  // dictation
  const hasDictation = 
    focusedWindow === window.mainWindow ||
    focusedWindow === window.promptAnywhereWindow ||
    focusedWindow === window.transcribePalette

  // done
  return [
    // { role: 'appMenu' }
    ...(isMac ? [
      {
        label: app.name,
        submenu: [
          { role: 'about' },
          ...(!isMas ? [
            {
              label: t('menu.app.checkForUpdates'),
              click: async () => callbacks.checkForUpdates()
            },
            { type: 'separator' },
          ] : []),
          {
            label: t('menu.app.settings'),
            accelerator: 'CmdOrCtrl+,',
            click: async () => callbacks.settings()
          },
          { type: 'separator' },
          { role: 'services' },
          { type: 'separator' },
          { role: 'hide' },
          { role: 'hideOthers' },
          { role: 'unhide' },
          { type: 'separator' },
          {
            label: t('menu.app.quit'),
            accelerator: 'CmdOrCtrl+Q',
            click: () => callbacks.quit()
          }
        ]
      }
    ] : []),
    {
      label: t('menu.file.title'),
      submenu: [
        {
          label: t('menu.file.quickPrompt'),
          accelerator: shortcutAccelerator(shortcuts?.prompt),
          click: () => callbacks.quickPrompt()
        },
        {
          label: t('menu.file.newChat'),
          accelerator: shortcutAccelerator(shortcuts?.chat),
          click: () => callbacks.newChat()
        },
        {
          label: t('menu.file.scratchpad'),
          accelerator: shortcutAccelerator(shortcuts?.scratchpad),
          click: () => callbacks.scratchpad()
        },
        { type: 'separator' },
        {
          label: t('menu.file.designStudio'),
          accelerator: shortcutAccelerator(shortcuts?.studio),
          click: () => callbacks.studio()
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' }
      ]
    },
    // { role: 'editMenu' }
    {
      label: t('menu.edit.title'),
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        ...(isMac
          ? [
            { role: 'pasteAndMatchStyle' },
            ...(focusedWindow === window.mainWindow ? [{
              label: t('menu.edit.deleteChat'),
              accelerator: shortcutAccelerator({ key: 'Backspace', meta: isMac }),
              click: () => window.notifyBrowserWindows('delete-chat')
            }] : []),
            ...(focusedWindow === window.designStudioWindow ? [{
              label: t('menu.edit.deleteMedia'),
              accelerator: shortcutAccelerator({ key: 'Backspace', meta: isMac }),
              click: () => window.notifyBrowserWindows('delete-media')
            }] : []),
            { role: 'selectAll' },
          ]
          : [
            { role: 'delete' },
            { type: 'separator' },
            { role: 'selectAll' }
          ]),
          ...(hasDictation ? [
            { type: 'separator' },
            {
              label: t('menu.edit.startDictation'),
              accelerator: shortcutAccelerator({ key: 'T', meta: true }),
              click: () => window.notifyBrowserWindows('start-dictation')
            }]: []
          ),
      ]
    },
    {
      label: t('menu.view.title'),
      submenu: [
        {
          label: t('menu.view.debug'),
          click: () => window.openDebugWindow()
        },
        { type: 'separator' },
        ...process.env.DEBUG ? [
          { role: 'reload' },
          { role: 'forceReload' },
          { role: 'toggleDevTools' },
          { type: 'separator' },
        ] : [],
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    { role: 'windowMenu' },
    {
      label: t('menu.help.title'),
      submenu: [
        {
          label: t('menu.help.goToDataFolder'),
          click: async () => {
            await shell.openPath(app.getPath('userData'))
          }
        },
        {
          label: t('menu.help.goToLogFolder'),
          click: async () => {
            await shell.openPath(app.getPath('logs'))
          }
        },
        { type: 'separator' },
        {
          label: t('menu.help.learnMore'),
          click: async () => {
            await shell.openExternal('https://github.com/nbonamy/witsy')
          }
        }
      ]
    }
  ]
}

export const installMenu = (app: App, callbacks: MenuCallbacks, shortcuts: ShortcutsConfig) => {
  const menu = Menu.buildFromTemplate(template(app, callbacks, shortcuts) as Array<any>)
  Menu.setApplicationMenu(menu)
}

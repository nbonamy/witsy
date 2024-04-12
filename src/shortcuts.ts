
import { App, globalShortcut } from 'electron';
import { settingsFilePath, loadSettings } from './config';
import { Shortcut, ShortcutCallbacks } from './index';

export const unregisterShortcuts = () => {
  console.info('Unregistering shortcuts')
  globalShortcut.unregisterAll();
}

export const registerShortcuts = (app: App, callbacks: ShortcutCallbacks) => {

  // unregister
  unregisterShortcuts();

  // load the config
  const config = loadSettings(settingsFilePath(app));

  // now register
  console.info('Registering shortcuts')
  registerShortcut(config.shortcuts.chat, callbacks.chat);
  registerShortcut(config.shortcuts.command, callbacks.command);

}

const keyToAccelerator = (key:string) => {
  if (key === '+') return 'Plus'
  if (key === '↑') return 'Up'
  if (key === '↓') return 'Down'
  if (key === '←') return 'Left'
  if (key === '→') return 'Right'
  return key
}

export const shortcutAccelerator = (shortcut:Shortcut) => {

  // null check
  if (shortcut == null) {
    return null
  }

  // build accelerator
  let accelerator = ''
  if (shortcut.alt) accelerator += 'Alt+'
  if (shortcut.ctrl) accelerator += 'Control+'
  if (shortcut.shift) accelerator += 'Shift+'
  if (shortcut.meta) accelerator += 'Command+'

  // key
  accelerator += keyToAccelerator(shortcut.key)

  // done
  return accelerator

}

const registerShortcut = (shortcut:Shortcut, callback: () => void) => {

  // check
  if (!shortcut || !callback) {
    return
  }
  
  // build accelerator
  let accelerator = shortcutAccelerator(shortcut)

  // debug
  console.debug('Registering shortcut', shortcut, accelerator)

  // do it
  globalShortcut.register(accelerator!, callback)

};

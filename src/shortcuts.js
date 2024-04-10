
const { globalShortcut } = require('electron');

export const unregisterShortcuts = () => {
  console.log('Unregistering shortcuts')
  globalShortcut.unregisterAll();
}

export const registerShortcuts = (shortcuts, callbacks) => {
  unregisterShortcuts();
  console.log('Registering shortcuts')
  if (shortcuts.chat && callbacks.chat) {
    registerShortcut(shortcuts.chat, callbacks.chat);
  }
  if (shortcuts.command && callbacks.command) {
    registerShortcut(shortcuts.command, callbacks.command);
  }
}

const keyToAccelerator = (key) => {
  if (key === '+') return 'Plus'
  if (key === '↑') return 'Up'
  if (key === '↓') return 'Down'
  if (key === '←') return 'Left'
  if (key === '→') return 'Right'
  return key
}

export const shortcutAccelerator = (shortcut) => {

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

const registerShortcut = (shortcut, callback) => {

  // build accelerator
  let accelerator = shortcutAccelerator(shortcut)

  // debug
  //console.log('Registering shortcut', shortcut, accelerator)

  // do it
  globalShortcut.register(accelerator, callback)

};

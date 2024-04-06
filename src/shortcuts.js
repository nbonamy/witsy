
const { globalShortcut } = require('electron');

export const shortcutAccelerator = (shortcut) => {

  // null check
  if (shortcut == null) {
    return null
  }

  // build accelerator
  let accelerator = ''
  if (shortcut.alt) accelerator += 'Alt+'
  if (shortcut.control) accelerator += 'Control+'
  if (shortcut.shift) accelerator += 'Shift+'
  if (shortcut.meta) accelerator += 'Command+'
  accelerator += shortcut.key

  // done
  return accelerator

}

export const registerShortcut = (shortcut, callback) => {

  // build accelerator
  let accelerator = shortcutAccelerator(shortcut)

  // debug
  //console.log('Registering shortcut', shortcut, accelerator)

  // do it
  globalShortcut.register(accelerator, callback)

};

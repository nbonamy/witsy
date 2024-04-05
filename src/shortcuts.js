
const { globalShortcut } = require('electron');

export const registerShortcut = (shortcut, callback) => {

  // build accelerator
  let accelerator = ''
  if (shortcut.alt) accelerator += 'Alt+'
  if (shortcut.control) accelerator += 'Control+'
  if (shortcut.shift) accelerator += 'Shift+'
  accelerator += shortcut.key

  // debug
  //console.log('Registering shortcut', shortcut, accelerator)

  // do it
  globalShortcut.register(accelerator, callback)

};

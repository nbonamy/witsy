
import { App, globalShortcut } from 'electron';
import { ShortcutCallbacks } from 'types/automation';
import { Shortcut, disabledShortcutKey } from 'types/index';
import { loadSettings } from './config';


export const unregisterShortcuts = () => {
  console.info('Unregistering shortcuts')
  globalShortcut.unregisterAll();
}

export const registerShortcuts = (app: App, callbacks: ShortcutCallbacks): void => {

  // unregister
  unregisterShortcuts();

  // load the config
  const config = loadSettings(app);

  // now register
  console.info('Registering shortcuts')
  registerShortcut('prompt', config.shortcuts.prompt, callbacks.prompt);
  registerShortcut('chat', config.shortcuts.main, callbacks.chat);
  registerShortcut('scratchpad', config.shortcuts.scratchpad, callbacks.scratchpad);
  registerShortcut('command', config.shortcuts.command, callbacks.command);
  registerShortcut('readaloud', config.shortcuts.readaloud, callbacks.readaloud);
  registerShortcut('transcribe', config.shortcuts.transcribe, callbacks.transcribe);
  registerShortcut('realtime', config.shortcuts.realtime, callbacks.realtime);
  registerShortcut('studio', config.shortcuts.studio, callbacks.studio);
  registerShortcut('forge', config.shortcuts.forge, callbacks.forge);

}

const keyToAccelerator = (key: string): string => {
  if (key === '+') return 'Plus'
  if (key === '↑') return 'Up'
  if (key === '↓') return 'Down'
  if (key === '←') return 'Left'
  if (key === '→') return 'Right'
  if (key === 'NumpadAdd') return 'numadd'
  if (key === 'NumpadSubtract') return 'numsub'
  if (key === 'NumpadMultiply') return 'nummult'
  if (key === 'NumpadDivide') return 'numdiv'
  if (key === 'NumpadDecimal') return 'numdec'
  if (key.startsWith('Numpad')) return `num${key.substring(6).toLowerCase()}`
  return key
}

export const shortcutAccelerator = (shortcut?: Shortcut|null): string => {

  // null check
  if (!shortcut || shortcut.key === disabledShortcutKey) { 
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

const registerShortcut = (name: string, shortcut: Shortcut, callback: () => void): void => {

  // check
  if (!shortcut || !callback) {
    return
  }
  
  // build accelerator
  const accelerator = shortcutAccelerator(shortcut)
  if (accelerator === null) {
    return
  }

  // debug
  console.debug('[scut] Registering shortcut', shortcut, accelerator)

  // do it
  try {
    globalShortcut.register(accelerator, callback)
  } catch (error) {
    console.error(`[scut] Failed to register shortcut for ${name}:`, error)
  }

};

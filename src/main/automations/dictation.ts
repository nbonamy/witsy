
import { App } from 'electron'
import * as window from '../window'
import { loadSettings } from '../config'
import Automator from './automator'

const DOUBLE_TAP_TIMEOUT = 400 // ms

export default class Dictation {

  private app: App
  private lastKeyDownTime = 0
  private isHolding = false

  constructor(app: App) {
    this.app = app
  }

  onShortcutDown(): void {
    const config = loadSettings(this.app)
    const activation = config.stt?.quickDictation?.activation ?? 'tap'

    if (activation === 'tap') {
      Dictation.initDictation()
    } else if (activation === 'doubleTap') {
      // if window is already open, single tap stops it
      if (Dictation.isDictationWindowOpen()) {
        Dictation.stopDictation()
        this.lastKeyDownTime = 0
        return
      }
      const now = Date.now()
      if (now - this.lastKeyDownTime < DOUBLE_TAP_TIMEOUT) {
        Dictation.initDictation()
        this.lastKeyDownTime = 0 // reset to prevent triple tap
      } else {
        this.lastKeyDownTime = now
      }
    } else if (activation === 'hold') {
      this.isHolding = true
      Dictation.initDictation()
    }
  }

  onShortcutUp(): void {
    const config = loadSettings(this.app)
    const activation = config.stt?.quickDictation?.activation ?? 'tap'

    if (activation === 'hold' && this.isHolding) {
      this.isHolding = false
      Dictation.stopDictation()
    }
  }

  static isDictationWindowOpen(): boolean {
    return window.dictationWindow && !window.dictationWindow.isDestroyed() && window.dictationWindow.isVisible()
  }

  static stopDictation(): void {
    if (Dictation.isDictationWindowOpen()) {
      window.dictationWindow.webContents.send('stop-and-transcribe')
    }
  }

  static initDictation = async (): Promise<void> => {

    // if dictation window is already open and visible, tell it to stop and transcribe
    if (Dictation.isDictationWindowOpen()) {
      Dictation.stopDictation()
      return;
    }

    // capture the foremost app before opening the window
    const automator = new Automator();
    let sourceApp = null;
    try {
      sourceApp = await automator.getForemostApp();
    } catch (error) {
      console.error('Error getting foremost app', error);
    }

    // open the mini dictation window
    window.openDictationWindow({ sourceApp });

  }

  static insertTranscription = async (text: string): Promise<void> => {
      
      // done
      window.mainWindow.minimize();
      await window.releaseFocus();

      // now paste
      console.debug(`Processing transcription output: ${text.slice(0, 50)}…`);

      // we need an automator
      const automator = new Automator();
      await automator.pasteText(text)

      // done
      return;

  }
}

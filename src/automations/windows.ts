
import { Application } from '../types/automation';
import { runVbs } from '@el3um4s/run-vbs'
import NutAutomator from './nut';

export default class extends NutAutomator {

  constructor() {
    super();
    this.setup();
  }

  async getForemostApp(): Promise<Application|null> {
    console.warn('getForemostApp not implemented (expected)');
    return null;
  }

  async selectAll() {

    const script = `
      Set WshShell = WScript.CreateObject("WScript.Shell")
      WshShell.SendKeys "^a"
      WScript.Sleep 200
    `

    // run it
    await runVbs({ vbs: script }) 
    
  }
  
  async moveCaretBelow() {

    const script = `
      Set WshShell = WScript.CreateObject("WScript.Shell")
      WshShell.SendKeys "{DOWN}{ENTER}"
      WScript.Sleep 200
    `

    // run it
    await runVbs({ vbs: script }) 
  }

  async copySelectedText() {

    try {

      //await super.copySelectedText();
      if (!await this.setup()) throw new Error('nutjs not loaded');
      await this.nut().keyboard.pressKey(this.commandKey(), this.nut().Key.C);
      await this.nut().keyboard.releaseKey(this.commandKey(), this.nut().Key.C);
      
    } catch {

      const script = `
        Set WshShell = WScript.CreateObject("WScript.Shell")
        WshShell.SendKeys "^c"
        WScript.Sleep 20
      `

      // run it
      await runVbs({ vbs: script }) 

    }
  
  }

  async deleteSelectedText() {

    const script = `
      Set WshShell = WScript.CreateObject("WScript.Shell")
      WshShell.SendKeys "{DELETE}"
      WScript.Sleep 200
    `

    // run it
    await runVbs({ vbs: script }) 
  }

  async pasteText() {

    const script = `
      Set WshShell = WScript.CreateObject("WScript.Shell")
      WshShell.SendKeys "^v"
      WScript.Sleep 200
    `

    // run it
    await runVbs({ vbs: script }) 
    
  }

}
